#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

import { setTimeout as sleep } from 'node:timers/promises';

import Uhk, { errorHandler, yargs } from './src/index.js';

const CLOCK_FIRMWARE_REPO = 'jiunbae/firmware';
const CLOCK_FIRMWARE_TAGS = [
    '979a01324',
    '2b9e6ac47',
];

function getSetClockCommand(): string {
    const now = new Date();
    return `setClock ${now.getHours()} ${now.getMinutes()} ${now.getSeconds()}`;
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function assertClockFirmware(operations: ReturnType<typeof Uhk>['operations']): Promise<void> {
    const version = await operations.getDeviceVersionInfo();

    if (version.firmwareGitRepo === CLOCK_FIRMWARE_REPO && CLOCK_FIRMWARE_TAGS.includes(version.firmwareGitTag ?? '')) {
        return;
    }

    throw new Error(
        `The connected keyboard does not support setClock. ` +
        `Expected firmware ${CLOCK_FIRMWARE_REPO}/${CLOCK_FIRMWARE_TAGS.join('|')}, ` +
        `got ${version.firmwareGitRepo ?? 'unknown'}/${version.firmwareGitTag ?? 'unknown'}.`
    );
}

async function syncClock(argv: unknown): Promise<string> {
    const { device, operations } = Uhk(argv);
    const command = getSetClockCommand();

    try {
        await assertClockFirmware(operations);
        await operations.execMacroCommand(command);
        return command;
    } finally {
        await device.close();
    }
}

(async function () {
    try {
        const argv = yargs
            .scriptName('./sync-clock.ts')
            .usage('Usage: $0 [--once] [--interval seconds] [--retry-interval seconds]')
            .option('interval', {
                description: 'Sync interval in seconds. Default is 300 seconds.',
                type: 'number',
                default: 300,
            })
            .option('once', {
                description: 'Sync once and exit.',
                type: 'boolean',
                default: false,
            })
            .option('retry-interval', {
                description: 'Retry interval in seconds after a failed sync. Default is 10 seconds.',
                type: 'number',
                default: 10,
            })
            .argv;

        const intervalSeconds = Number(argv.interval);
        if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
            throw new Error('The sync interval must be a positive number of seconds.');
        }

        const retryIntervalSeconds = Number(argv.retryInterval);
        if (!Number.isFinite(retryIntervalSeconds) || retryIntervalSeconds <= 0) {
            throw new Error('The retry interval must be a positive number of seconds.');
        }

        for (;;) {
            try {
                const command = await syncClock(argv);
                console.log(`Synced UHK clock: ${command}`);
                if (argv.once) {
                    break;
                }
                await sleep(intervalSeconds * 1000);
            } catch (error) {
                if (argv.once) {
                    throw error;
                }
                console.error(`Clock sync failed: ${formatError(error)}`);
                await sleep(retryIntervalSeconds * 1000);
            }
        }
    } catch (error) {
        await errorHandler(error);
    }
})();

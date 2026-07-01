#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

import { setTimeout as sleep } from 'node:timers/promises';

import Uhk, { errorHandler, yargs } from './src/index.js';

function getSetClockCommand(): string {
    const now = new Date();
    return `setClock ${now.getHours()} ${now.getMinutes()} ${now.getSeconds()}`;
}

(async function () {
    try {
        const argv = yargs
            .scriptName('./sync-clock.ts')
            .usage('Usage: $0 [--once] [--interval seconds]')
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
            .argv;

        const intervalSeconds = Number(argv.interval);
        if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
            throw new Error('The sync interval must be a positive number of seconds.');
        }

        const { operations } = Uhk(argv);

        do {
            const command = getSetClockCommand();
            await operations.execMacroCommand(command);
            console.log(`Synced UHK clock: ${command}`);

            if (!argv.once) {
                await sleep(intervalSeconds * 1000);
            }
        } while (!argv.once);
    } catch (error) {
        await errorHandler(error);
    }
})();

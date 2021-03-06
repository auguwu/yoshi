/**
 * Copyright (c) 2021 Noel
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Yoshi } from './yoshi';
import yargs from 'yargs';

const argv = yargs
  .option(
    'c',
    {
      alias: ['compose', 'exclude-compose'],
      description: 'Excludes Docker Compose containers'
    }
  )
  .option(
    'i',
    {
      alias: 'include',
      description: 'Includes any Docker containers if needed'
    }
  )
  .option(
    'e',
    {
      alias: ['exclude', 'ignore', 'hide'],
      description: 'Excludes any Docker containers if needed, use the `--exclude-compose` if need to exclude Docker Compose containers.'
    }
  )
  .option(
    'k',
    {
      alias: ['kube', 'kubernetes'],
      description: 'Displays Kubernetes pod logs if Kubernetes is installed in the system.'
    }
  )
  .strict()
  .alias('v', 'version')
  .help('h')
  .alias('h', 'help')
  .argv;

const cli = async () => {
  const args = await argv;
  const excludeCompose = args.c !== undefined;
  const includeKube = args.k !== undefined;

  const yoshi = new Yoshi({
    excludeCompose,
    kube: includeKube
  });

  await yoshi.start();
  process.on('SIGINT', () => {
    yoshi.close();
    process.exit(0);
  });
};

cli();

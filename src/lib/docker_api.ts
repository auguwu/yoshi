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

import http from 'http';

/**
 * List of options available for constructing [[DockerAPI]] instances.
 */
export interface DockerAPIOptions {
  /**
   * The host for connecting to Docker Engine
   */
  host?: string;

  /**
   * Port for connecting to Docker Engine
   */
  port?: number;

  /**
   * Unix socket or Windows named pipe for connecting to Docker Engine
   */
  socket?: string;

  /**
   * Minimal Docker Engine version to use
   */
  version?: string;

  /**
   * TLS configuration, if needed x3
   */
  tls?: Record<'ca' | 'cert' | 'key' | 'passphrase', string | null | undefined>;
}

/**
 * Represents a client for connecting to Docker Engine
 */
export class DockerAPI {
  /**
   * Represents the options for this [[DockerAPI]].
   */
  private options: DockerAPIOptions = {};

  /**
   * Creates a new [[DockerAPI]] instance.
   * @param options Any additional options to use
   */
  constructor(options: DockerAPIOptions = {}) {
    this.options = Object.assign(options, {
      host: undefined,
      port: undefined,
      socket: undefined,
      version: '1.32',
      tls: {
        ca: null,
        cert: null,
        key: null,
        passphrase: null
      }
    });
  }

  private _constructUrl(path: string) {
    const protocol = this.options.tls?.cert !== null ? 'https' : 'http';
    let url = `${protocol}://`;

    if (this.options.socket !== undefined) {
      url += `unix:${this.options.socket}:`;
    } else {
      url += `${this.options.host}:${this.options.port}`;
    }

    url += `/v${this.options.version}${path}`;
    return url;
  }
}

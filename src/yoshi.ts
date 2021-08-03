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

import { KubeConfig, CoreV1Api, V1PodList } from '@kubernetes/client-node';
import blessed from 'blessed';
import Docker from 'dockerode';
import fetch from 'node-fetch';
import fs from 'fs';
import WebSocket from 'ws';

// Credit: https://github.com/sindresorhus/is-docker
const isDocker = (() => {
  const hasDockerEnv = () => {
    try {
      fs.statSync('/.dockerenv');
      return true;
    } catch {
      return false;
    }
  };

  const hasDockerCGroup = () => {
    try {
      return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
    } catch {
      return false;
    }
  };

  return hasDockerEnv() || hasDockerCGroup();
})();

/**
 * Represents a list of options for configuring **yoshi**.
 */
export interface YoshiOptions {
  /**
   * If docker-compose should be excluded from being logged.
   */
  excludeCompose?: boolean;

  /**
   * Array of what containers that are allowed to be viewed.
   */
  include?: string[];

  /**
   * Array of what containers are not allowed to be viewed.
   */
  exclude?: string[];

  /**
   * If Kubernetes pod logs are allowed to be viewed.
   */
  kube?: boolean | YoshiKubeOptions;
}

/**
 * Options for displaying Kubernetes pod logs
 */
export interface YoshiKubeOptions {
  /** The namespace to use, if this isn't defined, it'll try to get all pods in all namespaces */
  namespace?: string;

  /** If pod logs should be displayed or not. */
  display?: boolean;
}

/**
 * Simple interface with a **close** function.
 */
export interface Closeable {
  /**
   * Closes this object and disposes any resources, if needed.
   */
  close(): void;
}

type DecoupleArray<T> = T extends (infer U)[] ? U : never;

const isKubePod = (item: any): item is DecoupleArray<V1PodList['items']> => item.metadata !== undefined;

export class Yoshi implements Closeable {
  #kubeConfig?: KubeConfig;
  #kubeApi?: CoreV1Api;
  #options: YoshiOptions;
  #screen?: blessed.Widgets.Screen;
  #docker: Docker;
  #ws?: WebSocket;

  constructor(options: YoshiOptions = {}) {
    this.#options = Object.assign<YoshiOptions, YoshiOptions>(options, {
      excludeCompose: false,
      exclude: [],
      include: []
    });

    this.#docker = new Docker();

    const enabled = options.kube !== undefined && (
      typeof options.kube === 'boolean'
        ? options.kube === true
        : options.kube?.display === true
    );

    if (options.kube !== undefined && enabled) {
      this.#kubeConfig = new KubeConfig();
      this.#kubeConfig!.loadFromDefault();

      this.#kubeApi = this.#kubeConfig.makeApiClient(CoreV1Api);
    }
  }

  /**
   * Creates a new blessed screen to view logs from.
   * @internal
   */
  private createScreen() {
    if (this.#screen !== undefined)
      throw new SyntaxError('cannot create more than 1 screen');

    this.#screen = blessed.screen({
      smartCSR: true,
      autoPadding: true
    });
  }

  private createSingleLogScreen() {
    const screen = blessed.box({
      parent: this.#screen,
      width: '50%',
      height: '100%',
      content: 'no logs are contained here. :(',
      label: 'Logs for ???',
      border: {
        type: 'line',
        fg: 25
      }
    });

    return screen;
  }

  private async createInfoBox() {
    const dockerVersion = await this.#docker.version();

    // create a tiny box for display information
    const yoshiVersion = require('../package.json').version;
    const infoBox = blessed.box({
      parent: this.#screen,
      content: `Docker: v${dockerVersion.ApiVersion}\nYoshi:  v${yoshiVersion}`,
      width: '40%',
      height: '30%',
      top: '70%',
      left: '60%',
      label: 'Misc. Information',
      border: {
        type: 'line',
        fg: 39
      }
    });

    return infoBox;
  }

  private async getK8sPods() {
    if (this.#kubeApi === undefined)
      return null;

    if (this.#options.kube === undefined)
      return null;

    if (typeof this.#options.kube === 'boolean')
      return this.#kubeApi.listPodForAllNamespaces(
        /* allowWatchBookmarks? */  undefined,
        /* _continue? */            undefined,
        /* fieldSelector? */        undefined,
        /* labelSelector? */        undefined,
        /* limit? */                undefined,
        /* pretty? */               undefined,
        /* resourceVersion? */      undefined,
        /* resourceVersionMatch? */ undefined,
        /* timeoutSeconds? */       undefined,
        /* watch? */                false,
        /* options? */              undefined
      ).then(r => r.body).catch(() => null);

    if (this.#options.kube!.display !== undefined && !this.#options.kube!.display)
      return null;

    if (this.#options.kube!.namespace === undefined)
      return this.#kubeApi.listPodForAllNamespaces(
        /* allowWatchBookmarks? */  undefined,
        /* _continue? */            undefined,
        /* fieldSelector? */        undefined,
        /* labelSelector? */        undefined,
        /* limit? */                undefined,
        /* pretty? */               undefined,
        /* resourceVersion? */      undefined,
        /* resourceVersionMatch? */ undefined,
        /* timeoutSeconds? */       undefined,
        /* watch? */                false,
        /* options? */              undefined
      ).then(r => r.body).catch(() => null);

    return this.#kubeApi.listNamespacedPod(
      this.#options.kube!.namespace,
      /* pretty? */ undefined,
      /* allowWatchBookmarks? */  undefined,
      /* _continue? */            undefined,
      /* fieldSelector? */        undefined,
      /* labelSelector? */        undefined,
      /* limit? */                undefined,
      /* resourceVersion? */      undefined,
      /* resourceVersionMatch? */ undefined,
      /* timeoutSeconds? */       undefined,
      /* watch? */                false,
      /* options? */              undefined
    ).then(r => r.body).catch(() => null);
  }

  private async createSelectContainers() {
    const containers = await this.#docker.listContainers();
    const pods = this.#kubeApi !== undefined ? await this.getK8sPods() : undefined;

    const selection = blessed.list({
      parent: this.#screen,
      left: '60%',
      width: '70%',
      height: '60%',
      label: `Containers [${containers.length}]${pods !== undefined && pods !== null ? ` / Pods [${pods.items.length}]` : ''}`,
      border: {
        type: 'line',
        fg: 39
      },
      style: {
        selected: {
          bg: 'cyan',
          fg: 'gray'
        }
      },
      items: [
        ...containers.map(c => `${c.Names[0].replace('/', '')} (${c.State})`),
        ...(pods !== undefined && pods !== null ? pods.items.map(pod => `${pod.metadata!.name!} (${pod.metadata!})`) : [])
      ]
    });

    selection.on('select', async (item) => {
      // get pod / container
      const podOrContainer = (
        pods !== undefined && pods !== null
          ? pods.items.filter(c => c.metadata!.name === item.content)
          : containers.filter(c => c.Names[0].replace('/', '') === item.content)
      )[0];

      if (isKubePod(podOrContainer)) {
        this.#screen!.title = `viewing logs for ${podOrContainer.metadata!.name}`;
        this.#screen!.children.find(c => c.type === 'box')?.destroy(); // log screen is only a box anyway >w>

        // Kubernetes follow logs are a WebSocket stream,
        // so we need to create a WebSocket connection
      } else {
        // i think this is a ndoe.js stream? iunno lol
        this.#screen!.title = `viewing logs for ${podOrContainer.Names[0].replace('/', '')}`;
        this.#screen!.children.find(c => c.type === 'box')?.destroy(); // log screen is only a box anyway >w>

        const socketPath: string = (this.#docker.modem as any).socketPath;
        const res = await fetch(`${socketPath}/containers/${podOrContainer.Id}/attach?hijack=true&stream=1&stdout=1`, {
          method: 'POST',
          headers: {
            Connection: 'Upgrade',
            Upgrade: 'tcp'
          }
        });
      }
    });

    return selection;
  }

  /**
   * Starts a new **yoshi** session.
   */
  async start() {
    if (isDocker)
      throw new SyntaxError('Cannot run yoshi under a Docker container');

    // create a new blessed screen
    this.createScreen();
    this.#screen!.title = 'yoshi ~ viewing logs for no container';

    const logScreen = this.createSingleLogScreen();
    const info = await this.createInfoBox();
    const selection = await this.createSelectContainers();

    this.#screen!.append(logScreen);
    this.#screen!.append(selection);
    this.#screen!.append(info);

    this.#screen!.render();
  }

  close() {
    this.#screen?.destroy();
    this.#screen = undefined;
  }
}

# yoshi
> 🎻🌆 **simple, and small tool to check all logs within a Docker workflow**
>
> Note: **yoshi** is never meant to be capitilized. if you mention it in a sentence, it's spelt as **yoshi** not **Yoshi**.

## Features
- **Robust** -- yoshi is meant to be robust and will not crash if no logs are permitted in a container.
- **Simple** -- yoshi is meant to be simple and small, so no big configuration files, no complex flags, no complicated commands.

## Installation
You can simply install yoshi with **npm** or **yarn**:

```sh
# NPM
$ npm i -g @augu/yoshi

# Yarn
yarn global add @augu/yoshi
```

If you run the **yoshi** binary with no arguments, it'll print the logs in the terminal:

![example]()

You can omit specific containers using the **--exclude** or `-e` flags, you can also use the **--include** or `-i` flags to only show logs from specific containers.

## License
**yoshi** is licensed under the MIT license, read the LICENSE file for more information.

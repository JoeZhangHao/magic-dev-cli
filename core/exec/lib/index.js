'use strict';

const cp = require('child_process');
const path = require('path');
const Package = require('@magic-cli-dev/package');
const log = require('@magic-cli-dev/log');

const SETTINGS = {
	init: '@imooc-cli/init'
}

// npm 包缓存目录
const CACHE_DIR = 'dependencies';

async function exec() {
	let targetPath = process.env.CLI_TARGET_PATH;
	const homePath = process.env.CLI_HOME_PATH;
	let storeDir = '';
	let pkg;
	log.verbose('targetPath: ', targetPath);
	log.verbose('homePath: ', homePath);

	const cmdObj = arguments[arguments.length - 1];
	const cmdName = cmdObj.name();
	const packageName = SETTINGS[cmdName];
	const packageVersion = 'latest';

	// targetPath 不存在的时候
	if (!targetPath) {
		// 生成 package 的缓存路径
		targetPath = path.resolve(homePath, CACHE_DIR); // 生成缓存路径
		storeDir = path.resolve(targetPath, 'node_modules');
		log.verbose('targetPath', targetPath);
		log.verbose('storeDir', storeDir);

		pkg = new Package({
			targetPath,
			storeDir,
			packageName,
			packageVersion
		});

		// package 是否存在
		const isExists = await pkg.exists();
		if (isExists) {
			// 更新 package
			await pkg.update();
		} else {
			// 安装 package
			await pkg.install();
		}
	} else {
		pkg = new Package({
			targetPath,
			packageName,
			packageVersion
		});
	}

	const rootFile = pkg.getRootFilePath();
	console.log('rootFile: ', rootFile);
	// 类似执行 lib/index.js
	// 将 arguments 拍平，作为参数传入
	if (rootFile) {
		try {
			// 在当前进程中调用
			// 1. require(rootFile).call(null, Array.from(arguments));

			// 改造为在 node 子进程中使用
			const args = Array.from(arguments);
			const cmd = args[args.length - 1];
			const o = Object.create(null);
			Object.keys(cmd).forEach(key => {
				if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
					o[key] = cmd[key];
				}
			})
			args[args.length - 1] = o;
			const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`;
			// window 下可能是 const child = cp.spawn('cmd', ['/c', '-e', code], {
			const child = spawn('node', ['-e', code], {
				cwd: process.cwd(),
				// 输出流输出至当前的主进程中，不然就得异步监听输出流
				// [http://nodejs.cn/api/child_process.html#child_process_options_stdio]
				stdio: 'inherit'
			});
			child.on('error', (e) => {
				log.error(e.message);
				process.exit(1);
			});
			child.on('exit', (e) => {
				log.verbose('命令执行成功: ' + e);
			});
		} catch (error) {
			log.error(error.message);
		}

	}
}

// 兼容 window 环境和 mac 环境
function spawn(command, args, options) {
	const win32 = process.platform === 'win32';

	const cmd = win32 ? 'cmd' : command;
	const cmdArgs = win32 ? ['/c'].concat(command, args) : args;

	return cp.spawn(cmd, cmdArgs, options || {});
}

module.exports = exec;
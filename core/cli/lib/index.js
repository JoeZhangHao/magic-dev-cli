'use strict';

module.exports = core;

const path = require('path')
const semver = require('semver');
const colors = require('colors/safe');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;
const commander = require('commander')

const log = require('@magic-cli-dev/log');
// commands
const init = require('@magic-cli-dev/init')
const exec = require('@magic-cli-dev/exec')

const pkg = require('../package.json');
const constant = require('./const');


let args;

const program = new commander.Command();

async function core() {
	try {
		await prepare();
		registerCommand();
	} catch (e) {
		log.error(e.message);
		if (process.env.LOG_LEVEL === 'verbose') {
			console.log(e);
		}
	}
}

async function prepare() {
	checkPkgVersion();
	checkRoot();
	checkUserHome();
	checkEnv();
	await checkGlobalUpdate();
}

function registerCommand() {
	program
		.name(Object.keys(pkg.bin)[0])
		.usage('<command> [options]') // log name + usage
		.version(pkg.version)
		.option('-d, --debug', '是否开启调试模式', false)
		.option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '');


	program
		.command('init [projectName]')
		.option('-f, --force', '是否强制初始化项目', false)
		.action(exec);

	// 开启 debug 模式
	program.on('option:debug', function () {
		if (this.opts().debug) {
			process.env.LOG_LEVEL = 'verbose';
		} else {
			process.env.LOG_LEVEL = 'info';
		}
		log.level = process.env.LOG_LEVEL;
	})

	// 指定 targetPath
	program.on('option:targetPath', function () {
		process.env.CLI_TARGET_PATH = this.opts().targetPath
	});

	// 对未知命令监听
	program.on('command:*', function (obj) {
		const availableCommaneds = program.commands.map((cmd) => cmd.name());
		log.verbose(colors.red('未知的命令： ' + obj[0]));
		if (availableCommaneds.length > 0) {
			log.verbose(colors.red('可用命令：' + availableCommaneds.join(',')));
		}
	});

	program.parse(process.argv);

	// 没有被使用的选项会被放在 args 中
	log.verbose('process.args: ', process.args);
	// 打印下当前传的配置项
	log.verbose('options: ', program.opts());

	if (process.args && process.argv.length < 1) {
		program.outputHelp();
	}

}

async function checkGlobalUpdate() {
	// 1. 获取当前版本号和模块名
	const currentVersion = pkg.version;
	const npmName = pkg.name;
	// 2. 调用 npm API，拿到版本历史
	const { getNpmSemverVersion } = require('@magic-cli-dev/get-npm-info')
	// 3. 提取所有版本号，比对那些版本是大于当前版本号
	const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
	// 4. 获取最新的版本号，提示用户更新到该版本
	if (lastVersion && semver.gt(lastVersion, currentVersion)) {
		log.warn(colors.yellow(`请手动更新 ${npmName}， 当前版本 ${currentVersion}, 最新版本 ${lastVersion}
			更新命令: npm install -g ${npmName}`));
	}
}

function checkEnv() {
	const dotenv = require('dotenv')
	const dotenvPath = path.resolve(userHome, '.env')
	if (pathExists(dotenvPath)) {
		dotenv.config({
			path: dotenvPath
		})
		log.verbose('process.env: ', process.env);
	}
	createDefaultConfig();
}

function createDefaultConfig() {
	const cliConfig = {
		home: userHome,
	};
	if (process.env.CLI_HOME) {
		cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME);
	} else {
		cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME);
	}
	process.env.CLI_HOME_PATH = cliConfig.cliHome;
}

// 验证用户主目录是否存在
function checkUserHome() {
	if (!userHome || !pathExists(userHome)) {
		throw new Error(`当前登录用户主目录不存在`)
	}
}

// 检查 root 权限
function checkRoot() {
	// root-check 文件 root 权限降级
	const rootCheck = require('root-check');
	rootCheck();
}

// 输出项目版本
function checkPkgVersion() {
	log.notice('cli', pkg.version);
}

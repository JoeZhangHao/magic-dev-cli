'use strict';

const fs = require('fs');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');
const userHome = require('user-home');
const kebabBase = require('kebab-case');
const glob = require('glob');
const ejs = require('ejs');

const Command = require('@magic-cli-dev/command');
const Packgae = require('@magic-cli-dev/package');
const log = require('@magic-cli-dev/log');
const { spinnerStart, sleep, execAsync } = require('@magic-cli-dev/utils');
const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

// 白名单命令
const WHITE_COMMAND = ['npm', 'cnpm', 'yarn'];

class InitCommand extends Command {
	init() {
		this.projectName = this._argv[0] || '';
		this.force = !!this._argv[1].force;
		log.verbose('projectName', this.projectName);
		log.verbose('force', this.force);
	}

	async exec() {
		try {
			// 1. 准备阶段
			const projectInfo = await this.prepare();
			if (projectInfo) {
				// 2. 下载模板
				log.verbose('projectInfo: ', projectInfo);
				this.projectInfo = projectInfo;
				await this.downloadTemplate();
				// 3. 安装模板
				await this.installTemplate();
			}
		} catch (error) {
			log.error(error.message);
			if (process.env.LOG_LEVEL === 'verbose') {
				console.log(error);
			}
		}
	}

	async installTemplate() {
		if (this.templateInfo) {
			this.templateInfo.type = this.templateInfo.type || TEMPLATE_TYPE_NORMAL;

			if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
				// 标准安装
				this.installNormalTemplate();
			} else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
				// 自定义安装
				this.installCustomTemplate();
			} else {
				throw new Error('项目模板类型无法识别');
			}
		} else {
			throw new Error('项目模板不存在');
		}
	}

	checkCommand(cmd) {
		if (WHITE_COMMAND.includes(cmd)) {
			return cmd;
		}
		return null;
	}

	// 执行命名字符串语句
	async execCommand(command, options) {
		let ret;
		if (command) {
			const commandArr = command.split(' ');
			const cmd = this.checkCommand(commandArr[0]);
			const args = commandArr.slice(1);

			if (!cmd) {
				throw new Error(`执行命令不在白名单中，当前命令为：${cmd}, 命令白名单为 ${WHITE_COMMAND.toString()}`);
			}

			ret = await execAsync(cmd, args, {
				stdio: 'inherit',
				cwd: process.cwd()
			});
		}

		if (ret !== 0) {
			throw new Error(options.errorMsg);
		}

		return ret;
	}

	// ejs 代码转换
	async ejsRender(options) {
		const dir = process.cwd();
		const projectInfo = this.projectInfo;

		return new Promise((resolve, reject) => {
			glob('**', {
				cwd: dir,
				ignore: options.ignore || '',
				nodir: true // 排除文件夹路径
			}, (err, files) => {
				if (err) {
					reject(err);
				}
				console.log('files: ', files);
				// 遍历当前所有文件
				Promise.all(files.map((file) => {
					const filePath = path.join(dir, file);
					return new Promise((fileRes, fileRej) => {
						ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
							if (err) {
								fileRej(err);
							} else {
								// 将生成的 ejs 结果写入到当前处理的文件中
								fse.writeFileSync(filePath, result);
								fileRes();
							}
						});
					});
				})).then(() => {
					resolve();
				}).catch((err) => {
					reject(err);
				})
			});
		});
	}

	// 安装默认模板
	async installNormalTemplate() {
		log.verbose('templateNpm', this.templateNpm);
		// 1. 安装模板项目到当前路径下
		let spinner = spinnerStart('正在安装模板...');
		await sleep();
		try {
			const templatePath = path.resolve(this, this.templateNpm.cacheFilePath, 'template');
			const targetPath = process.cwd();
			// ensureDirSync 保证路径一定存在，如果不存在，会创建目录
			// 获取 npmPackage 包的缓存地址路径
			fse.ensureDirSync(templatePath);
			fse.ensureDirSync(targetPath);
			fse.copySync(templatePath, targetPath);
		} catch (error) {
			throw e;
		} finally {
			spinner.stop(true);
			log.success('模板安装成功')
		}

		// 1.2 处理项目中的 ejs 格式的内容
		const templateIgnore = this.templateInfo.ignore || [];
		const ignore = ['node_modules/**', ...templateIgnore];
		await this.ejsRender({ ignore });

		// 2. 依赖安装
		let { installCommand, startCommand } = this.templateInfo;
		await this.execCommand(installCommand, {
			errorMsg: '依赖安装失败！'
		});
		// 3. 启动命令执行
		await this.execCommand(startCommand, {
			errorMsg: '启动执行命令失败！'
		});
	}

	// 安装自定义模板
	async installCustomTemplate() {
		// 查询自定义模板的入口文件
		if (await this.templateNpm.exists()) {
			const rootFile = this.templateNpm.getRootFilePath();
			if (fs.existsSync(rootFile)) {
				log.notice('开始执行自定义模板');
				const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
				const options = {
					templateInfo: this.templateInfo,
					projectInfo: this.projectInfo,
					sourcePath: templatePath,
					targetPath: process.cwd(),
				};
				const code = `require('${rootFile}')(${JSON.stringify(options)})`;
				log.verbose('code', code);
				await execAsync('node', ['-e', code], { stdio: 'inherit', cwd: process.cwd() });
				log.success('自定义模板安装成功');
			} else {
				throw new Error('自定义模板入口文件不存在！');
			}
		}
	}

	async downloadTemplate() {
		// 1. 通过项目模板 API 获取项目模板信息
		const { projectTemplate } = this.projectInfo;
		const templateInfo = this.template.find((item) => item.npmName === projectTemplate)
		// 当前模板信息挂载到 this
		this.templateInfo = templateInfo;
		console.log(templateInfo);
		// 1.1 通过 egg.js 搭建一套后端系统
		// 1.2 通过 npm 存储项目模板
		// 1.3 将项目模板信息存储到 mongodb 数据库中
		// 1.4 通过 egg.js 获取 mongodb 中的数据并且通过 API 返回
		const targetPath = path.resolve(userHome, '.magic-cli-dev', 'template');
		const storeDir = path.resolve(userHome, '.magic-cli-dev', 'template', 'node_modules');
		const { npmName, version } = templateInfo;
		const templateNpm = new Packgae({
			targetPath,
			storeDir,
			packageName: npmName,
			packageVersion: version
		});
		if (!await templateNpm.exists()) {
			const spinner = spinnerStart('正在下载模板..');
			await sleep(1000);
			try {
				await templateNpm.install();
			} catch (error) {
				throw error;
			} finally {
				spinner.stop(true);
				if (await templateNpm.exists()) {
					log.success('下载模板成功');
					this.templateNpm = templateNpm;
				}
			}
		} else {
			const spinner = spinnerStart('正在更新模板..');
			await sleep(1000);
			try {
				await templateNpm.update();
			} catch (error) {
				throw error;
			} finally {
				spinner.stop(true);
				if (await templateNpm.exists()) {
					log.success('更新模板成功');
					this.templateNpm = templateNpm;
				}
			}
		}
	}

	async prepare() {
		// 0. 判断模板是否存在
		const template = await getProjectTemplate();
		if (!template || template.length === 0) {
			throw new Error('项目模板不存在');
		}
		log.verbose('template: ', template);
		this.template = template;

		// 1. 判断当前目录是否为空
		const localPath = process.cwd();
		if (!this.isDirEmpty(localPath)) {
			let ifcontinue = false;
			if (!this.force) {
				// 询问是否继续创建
				ifcontinue = await inquirer.prompt({
					type: 'confirm',
					name: 'ifcontinue',
					default: false,
					message: '当前文件夹不为空，是否继续创建项目？'
				}).ifcontinue;

				if (!ifcontinue) {
					return;
				}
			}

			// 2. 是否启动强制更新
			if (ifcontinue || this.force) {
				// 二次确认是否清空当前目录下的文件
				const { confirmDelete } = await inquirer.prompt({
					type: 'confirm',
					name: 'confirmDelete',
					default: false,
					message: '是否确认清空当前目录下的文件？'
				})

				if (confirmDelete) {
					// 清空当前目录
					// emptyDirSync 只会清空不会删除当前文件夹
					fse.emptyDirSync(localPath);
				}
			}
		}

		return this.getProjectInfo();
	}

	async getProjectInfo() {
		// 校验规则
		// 1. 输入的首字符
		// 2. 尾字符必须为英文或数字，不能为字符
		// 3. 字符仅允许 "-_"
		// 合法：a, a-b, a_b, a-b-c, a_b_c, a-b1-c1, a_b1_c1, a1, a1-b1-c1, a1_ba_c1
		// 不合法：1, a_, a-, a_1, a-1
		// \w = a-zA-Z0-9_
		function isValidName(v) {
			return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v);
		}

		let projectInfo = {};
		// 判断用户输入的 projectName 是否合法
		let isProjectNameVaild = false;
		if (isValidName(this.projectName)) {
			isProjectNameVaild = true;
			projectInfo.projectName = this.projectName;
		}

		// 1. 选择创建项目或组件
		const { type } = await inquirer.prompt({
			type: 'list',
			name: 'type',
			message: '请选择初始化类型',
			default: TYPE_PROJECT,
			choices: [
				{
					name: '项目',
					value: TYPE_PROJECT
				},
				{
					name: '组件',
					value: TYPE_COMPONENT
				},
			]
		});

		// 将选项过滤为与类型一致的内容
		this.template = this.template.filter((template) => template.tag.includes(type));

		const title = type === TYPE_PROJECT ? '项目' : '组件';
		// 2. 获取项目的基本信息
		const projectNamePropt = {
			type: 'input',
			name: 'projectName',
			message: `请输入${title}名称`,
			default: '',
			validate: function (v) {
				const done = this.async();

				setTimeout(function () {
					if (!isValidName(v)) {
						done(`请输入合法的${title}名称
1. 输入的首字符
2. 尾字符必须为英文或数字，不能为字符
3. 字符仅允许 "-_"`);
						return;
					}
					done(null, true);
				}, 0);
			},
			filter: function (v) {
				return v;
			}
		}
		const projectPrompt = [];
		// 如果中的初始化时的项目名合法，则不需要再输入项目名
		if (!isProjectNameVaild) {
			projectPrompt.push(projectNamePropt);
		}
		projectPrompt.push(...[
			{
				type: 'input',
				name: 'projectVersion',
				message: `请输入${title}版本号`,
				default: '1.0.0',
				validate: function (v) {
					const done = this.async();

					setTimeout(function () {
						if (!semver.valid(v)) {
							done('请输入合法的版本号');
							return;
						}
						done(null, true);
					}, 0);
				},
				filter: function (v) {
					// semver.valid(v) 没通过时会返回 null， 这里处理 null 的情况
					if (!!semver.valid(v)) {
						return semver.valid(v);
					} else {
						return v;
					}
				}
			},
			{
				type: 'list',
				name: 'projectTemplate',
				message: `请选择${title}模板`,
				choices: this.createTemplateChioce()
			}
		]);

		let project = {};
		if (type === TYPE_COMPONENT) {
			// 获取组件描述
			const descriptionPrompt = {
				type: 'input',
				name: 'componentDescription',
				message: '请输入组件描述信息',
				default: '',
				validate: function (v) {
					const done = this.async();

					setTimeout(function () {
						if (!v) {
							done('请输入组件描述信息');
							return;
						}
						done(null, true);
					}, 0);
				}
			}

			projectPrompt.push(descriptionPrompt);
		}

		project = await inquirer.prompt(projectPrompt);
		projectInfo = {
			...projectInfo,
			type,
			...project
		}

		// 兼容 classname
		if (projectInfo.projectName) {
			projectInfo.name = projectInfo.projectName;
			projectInfo.className = kebabBase(projectInfo.projectName);
		}

		// 兼容 version
		if (projectInfo.projectVersion) {
			projectInfo.version = projectInfo.projectVersion;
		}

		// 兼容组件描述信息
		if (projectInfo.componentDescription) {
			projectInfo.description = projectInfo.componentDescription;
		}

		// return 项目的基本信息 (object)
		return projectInfo;
	}

	isDirEmpty(localPath) {
		// 1. 判断当前目录是否为空
		// 1. console.log(localPath);
		// 2. console.log(path.resolve('.'));
		// 3. __direname 不行，为当时执行位置
		let fileList = fs.readdirSync(localPath);
		fileList = fileList.filter((file) => (!file.startsWith('.') && ['node_modules'].indexOf(file) < 0));
		return !fileList || fileList.length <= 0;
	}

	createTemplateChioce() {
		return this.template.map((item) => ({
			value: item.npmName,
			name: item.name
		}))
	}
}

function init(argv) {
	return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
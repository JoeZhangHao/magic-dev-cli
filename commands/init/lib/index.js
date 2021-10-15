'use strict';

const fs = require('fs');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');

const Command = require('@magic-cli-dev/command');
const log = require('@magic-cli-dev/log');
const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

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
				// 3. 安装模板
				this.downloadTemplate();
			}
		} catch (error) {
			console.log(error.message);
		}
	}

	downloadTemplate() {
		// 1. 通过项目模板 API 获取项目模板信息
		// 1.1 通过 egg.js 搭建一套后端系统
		// 1.2 通过 npm 存储项目模板
		// 1.3 将项目模板信息存储到 mongodb 数据库中
		// 1.4 通过 egg.js 获取 mongodb 中的数据并且通过 API 返回
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
		let projectInfo = {};
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
		log.verbose('type: ', type);
		if (type === TYPE_PROJECT) {
			// 2. 获取项目的基本信息
			const project = await inquirer.prompt([
				{
					type: 'input',
					name: 'projectName',
					message: '请输入项目名称',
					default: '',
					validate: function (v) {
						const done = this.async();

						setTimeout(function () {
							// 校验规则
							// 1. 输入的首字符
							// 2. 尾字符必须为英文或数字，不能为字符
							// 3. 字符仅允许 "-_"
							// 合法：a, a-b, a_b, a-b-c, a_b_c, a-b1-c1, a_b1_c1, a1, a1-b1-c1, a1_ba_c1
							// 不合法：1, a_, a-, a_1, a-1
							// \w = a-zA-Z0-9_
							if (!/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)) {
								done(`请输入合法的项目名称
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
				},
				{
					type: 'input',
					name: 'projectVersion',
					message: '请输入项目版本号',
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
			])
			projectInfo = {
				type,
				...project
			}
		} else if (type === TYPE_COMPONENT) {

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
}

function init(argv) {
	return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
'use strict';

const Command = require('@magic-cli-dev/command');
const log = require('@magic-cli-dev/log');

class InitCommand extends Command {
	init() {
		this.projectName = this._argv[0] || '';
		this.force = !!this._argv[1].force;
		log.verbose('projectName', this.projectName);
		log.verbose('force', this.force);
	}

	exec() {
		console.log('init 的业务逻辑');
	}
}

function init(argv) {
	return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
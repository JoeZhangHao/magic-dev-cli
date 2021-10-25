'use strict';

const path = require('path');
const fse = require('fs-extra');
const pkgDir = require('pkg-dir').sync;
const npminstall = require('npminstall');
const pathExists = require('path-exists').sync;

const log = require('@magic-cli-dev/log');
const { isObject } = require('@magic-cli-dev/utils');
const formatPath = require('@magic-cli-dev/format-path');
const {
  getDefaultRegistry,
  getNpmLatestVersion
} = require('@magic-cli-dev/get-npm-info');

class Packgae {
  constructor(options) {
    if (!options) {
      throw new Error('Package 类的 options 参数不能为空！');
    }

    if (!isObject(options)) {
      throw new Error('Package 类的 options 参数必须为对象')
    }

    log.verbose('Packgae options: ', options);

    // package 的目标路径
    this.targetPath = options.targetPath;
    // 缓存 package 的路径
    this.storeDir = options.storeDir;
    // package 的 name
    this.packageName = options.packageName;
    // package 的版本
    this.packageVersion = options.packageVersion;
    // package 缓存目录的前缀
    this.cacheFilePathPrefix = this.packageName.replace('/', '_');

  }

  // 将 packageVersion 转换为具体的版本号
  async prepare() {
    if (!this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirSync(this.storeDir);
    }

    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLatestVersion(this.packageName);
    }
  }

  /**
   * 获取包缓存的具体路径
   * 
   * 系统缓存目录中的真实文件路径
   * _@imooc-cli_init@1.1.2@@imooc-cli
   * 
   * 需按照包名和版本转换为真实的文件路径
   * packageName: @imooc-cli/init
   * packageVersion: 1.1.2
   */
  get cacheFilePath() {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
  }

  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
  }

  // 判断当前 Package 是否存在
  async exists() {
    if (this.storeDir) {
      await this.prepare();
      return pathExists(this.cacheFilePath);
    } else {
      return pathExists(this.targetPath);
    }
  }

  // 安装 Package - npminstall
  async install() {
    await this.prepare();
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [{
        name: this.packageName,
        version: this.packageVersion,
      }]
    });
  }

  // 更新 Package
  async update() {
    await this.prepare();
    // 1. 获取最新的 npm 模板版本号
    const latestPackageVersion = await getNpmLatestVersion(this.packageName);
    // 2. 查询最新版本号对应的路径是否存在
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion);
    // 3. 如果不存在，则直接安装最新版本
    if (!pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(),
        pkgs: [{
          name: this.packageName,
          version: latestPackageVersion,
        }]
      })
    }
    // 下载完最新版本后更新版本号
    this.packageVersion = latestPackageVersion;
  }

  // 获取入口文件的路径
  getRootFilePath() {
    function _getRootFile(targetPath) {
      // 1. 获取 package.json 文件所在路径 - pkg-dir
      const dir = pkgDir(targetPath);
      if (dir) {
        // 2. 读取 package.json - require() js/json/node
        const pkgFile = require(path.resolve(dir, 'package.json'))
        // 3. main/lib - path
        if (pkgFile && pkgFile.main) {
          // 4. 路径的兼容(macOS/windows)
          return formatPath(path.resolve(dir, pkgFile.main));
        }
      }

      return null;
    }

    if (this.storeDir) {
      return _getRootFile(this.cacheFilePath);
    } else {
      return _getRootFile(this.targetPath);
    }
  }
}

module.exports = Packgae;

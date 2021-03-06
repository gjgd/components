'use strict';
const fs = require('fs-extra');
const spawn = require('child-process-ext/spawn');
const { writeMainAttrs, getServerlessFilePath } = require('../../serverlessFile');
const path = require('path');
const { legacyLoadComponentConfig, legacyLoadInstanceConfig } = require('../../utils');

class Unpacker {
  /**
   * Recusively unpacks a template, running npm i
   * or yarn install for each project
   * @param {*} cli
   * @param {*} tenantName
   * @param {*} serviceName
   */
  constructor(cli, tenantName, serviceName) {
    this.cli = cli;
    this.tenantName = tenantName;
    this.serviceName = serviceName;
  }

  /**
   * isComponents
   *
   * Uses logic from legacy.js to determine of project in
   * CWD is a component project or not, to determine which
   * attrs to write into sls.yml
   */
  isComponents() {
    let componentConfig;
    let instanceConfig;
    try {
      componentConfig = legacyLoadComponentConfig(process.cwd());
    } catch (e) {
      // ignore
    }
    try {
      instanceConfig = legacyLoadInstanceConfig(process.cwd());
    } catch (e) {
      // ignore
    }
    if (!componentConfig && !instanceConfig) {
      return false;
    }
    if (instanceConfig && !instanceConfig.component) {
      return false;
    }
    return true;
  }
  /**
   * Recursive method
   * @param {*} dir
   */
  async unpack(dir, isTopLevel = false) {
    // Check if the directory contains a serverless.yml/yaml/json/js.
    // If it does, we need to unpack it
    if (getServerlessFilePath(dir) || isTopLevel) {
      this.cli.sessionStatus(`Installing node_modules via npm in ${dir}`);
      if (await fs.exists(path.resolve(dir, 'package.json'))) {
        await spawn('npm', ['install'], { cwd: dir });
      }

      // Writes the tenantName and serviceName to the serverless.y(a)ml file
      // If projectType === v1
      if (this.isComponents()) {
        await writeMainAttrs(this.cli, dir, this.tenantName, this.serviceName);
      } else {
        await writeMainAttrs(this.cli, dir, this.tenantName, this.serviceName, this.serviceName);
      }
      const files = await fs.readdir(dir);
      await Promise.all(
        files.map(async (file) => {
          // Check if the file is a directory, or a file
          const stats = await fs.stat(`${dir}/${file}`);
          if (stats.isDirectory()) {
            return this.unpack(path.resolve(dir, file), false);
          }
          return null;
        })
      );
      return null;
    }
    return null;
  }
}

module.exports = Unpacker;

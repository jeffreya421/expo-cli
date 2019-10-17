import { TurtleApi, FormData, User } from '@expo/xdl';
import { Platform } from '@expo/config';
import { JSONObject } from '@expo/json-file';
import concat from 'concat-stream';
import delayAsync from 'delay-async';
import fs from 'fs-extra';
import ora from 'ora';
import tar from 'tar';

import BuildError from './BuildError';
import { Options } from './index';
import log from '../../log';
import { BuildStatus } from './BaseBuilder';


export interface ProjectConfig {
  data: Buffer;
  headers: JSONObject;
}

interface UserBuildData {
  credentials: any;
  platform: Platform;
  projectUrl: string;
  type: 'generic' | 'managed';
  artifactPath?: string;
}

function getUserData(options: Options, projectUrl: string) {
  const androidCredentials = {
    keystore: {
      keystoreData: 'MjEzNwo=',
      keystoreFile: 'android/keystores/release.keystore',
      keystorePassword: 'pass1',
      keyAlias: 'alias',
      keyPassword: 'pass2',
    },
  };
  return {
    artifactPath: './android/app/build/outputs/apk/release/app-release-unsigned.apk',
    credentials: androidCredentials,
    platform: options.platform,
    projectUrl,
    type: options.type,
  }
}

async function makeProjectTarball(projectDir: string, tarPath: string) {
  await tar.c({
    gzip: true,
    file: tarPath,
    cwd: projectDir,
    prefix: 'project',
  },
    ['.']
  );
}

async function prepareConfig(tarPath: string, projectDir: string): Promise<ProjectConfig> {
  await makeProjectTarball(projectDir, tarPath);
  const projectFormData = new FormData();
  projectFormData.append('file', fs.createReadStream(tarPath));
  const convertedFormData = await convertFormDataToBuffer(projectFormData);
  const { data } = convertedFormData;
  return {
    data,
    headers: projectFormData.getHeaders(),
  }
}

async function convertFormDataToBuffer(formData: FormData): Promise<{ data: Buffer }> {
  return new Promise(resolve => {
    formData.pipe(concat({ encoding: 'buffer' }, data => resolve({ data })));
  });
}

async function wait(user: User, buildId: string, { timeout = 1200, interval = 30 } = {}) {
  log(`Waiting for build to complete. You can press Ctrl+C to exit.`);
  let spinner = ora().start();
  let time = new Date().getTime();
  const endTime = time + timeout * 1000;
  while (time <= endTime) {
    const buildInfo = await getCurrentBuildInfo(user, buildId);
    switch (buildInfo.status) {
      case 'finished':
        spinner.succeed('Build finished.');
        return buildInfo.artifacts ? buildInfo.artifacts.s3Url : '';
      case 'in-queue':
        spinner.text = 'Build queued...';
        break;
      case 'in-progress':
        spinner.text = 'Build in progress...';
        break;
      case 'errored':
        spinner.fail('Build failed.');
        throw new BuildError(`Standalone build failed!`);
      default:
        spinner.warn('Unknown status.');
        throw new BuildError(`Unknown status: ${buildInfo} - aborting!`);
    }
    time = new Date().getTime();
    await delayAsync(interval * 1000);
  }
  spinner.warn('Timed out.');
  throw new BuildError(
    'Timeout reached! Project is taking longer than expected to finish building, aborting wait...'
  );
}

async function getCurrentBuildInfo(user: User, buildId: string): Promise<BuildStatus> {
  const buildInfo: BuildStatus = await TurtleApi.clientForUser(user).getAsync(`build/status/${buildId}`);
  return buildInfo;
}

export { getUserData, prepareConfig, wait };

import { TurtleApi, FormData } from '@expo/xdl';
import concat from 'concat-stream';
import fs from 'fs-extra';
import tar from 'tar';
import uuidv4 from 'uuid/v4';

import { Platform } from '@expo/config';
import { Options } from './index';
import { JSONObject } from '@expo/json-file';

// const secondsToMilliseconds = (seconds: number) => seconds * 1000;

type BuilderOptions = {
  platform: 'android' | 'ios';
  type: 'generic' | 'managed';
}

interface UserBuildData {
  platform: Platform;
  experienceId: string;
  experienceName: string;
  manifest: any;
  packageJson: any;
  projectUrl: string;
  type: string;
}

export interface StatusResult {
  builds: BuildsStatus[];
}

export interface BuildsStatus {
  status: string,
  platform: Platform,
  createdAt: string,
}

export interface ProjectConfig {
  data: Buffer;
  headers: JSONObject;
}

export default class BaseBuilder {
  options: BuilderOptions | null;
  projectDir = '';

  constructor(projectDir: string, options?: BuilderOptions) {
    this.projectDir = projectDir;
    this.options = options ? options : null;
  }

  async postBuild(projectDir: string, options: Options) {
    const tarName = `${uuidv4()}-project.tar.gz`;
    const tarPath = `/tmp/${tarName}`;
    try {
      const config = await this.prepareConfig(tarPath, projectDir);
      const response = await TurtleApi.clientForUser().uploadFile(config);
      const s3Url = response.s3Url;
      const data = this.getUserData(options, s3Url);
      return await TurtleApi.clientForUser().postAsync('build/start', data);
    } finally {
      fs.unlink(tarPath);
    }
  }

  async getStatus(): Promise<StatusResult> {
    return await TurtleApi.clientForUser().getAsync('build/status');
  }

  getUserData(options: Options, projectUrl: string) {
    return {
      platform: options.platform,
      experienceId: '2e6bf6a7-6499-41ac-a5e8-20ddd31c838f',
      experienceName: '@test/test',
      manifest: {},
      packageJson: {},
      projectUrl,
      type: options.type,
    }
  }

  async makeProjectTarball(projectPath: string, tarPath: string) {
    await tar.c({
      gzip: true,
      file: tarPath,
    },
      [projectPath]
    );
  }

  async prepareConfig(tarPath: string, projectDir: string): Promise<ProjectConfig> {
    await this.makeProjectTarball(projectDir, tarPath);
    const projectFormData = new FormData();
    projectFormData.append('file', fs.createReadStream(tarPath));
    const convertedFormData = await this.convertFormDataToBuffer(projectFormData);
    const { data } = convertedFormData;
    return {
      data,
      headers: projectFormData.getHeaders(),
    }
  }

  async convertFormDataToBuffer(formData: FormData): Promise<{ data: Buffer }> {
    return new Promise(resolve => {
      formData.pipe(concat({ encoding: 'buffer' }, data => resolve({ data })));
    });
  }
}

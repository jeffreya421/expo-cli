import { TurtleApi, User } from '@expo/xdl';
import fs from 'fs-extra';
import uuidv4 from 'uuid/v4';

import { Platform } from '@expo/config';
import { Options } from './index';
import { getUserData, prepareConfig } from './utils';

type BuilderOptions = {
  platform: 'android' | 'ios';
  type: 'generic' | 'managed';
}



export interface StatusResult {
  builds: BuildStatus[];
}

export interface BuildStatus {
  status: string,
  platform: Platform,
  artifacts?: { s3Url: string };
}


export default class BaseBuilder {
  options: BuilderOptions | null;
  projectDir: string;
  user: User | null;

  constructor(projectDir: string, user?: User, options?: BuilderOptions) {
    this.projectDir = projectDir;
    this.user = user ? user : null;
    this.options = options ? options : null;
  }

  async postBuild(projectDir: string, options: Options) {
    const tarName = `${uuidv4()}-project`;
    const tarPath = `/tmp/${tarName}`;
    try {
      const config = await prepareConfig(tarPath, projectDir);
      const response = await TurtleApi.clientForUser(this.user).uploadFile(config);
      const s3Url = response.s3Url;
      const data = getUserData(options, s3Url);
      return await TurtleApi.clientForUser(this.user).postAsync('build/start', data);
    } finally {
      fs.unlink(tarPath);
    }
  }

  async getStatusOfLatestBuilds(user: User): Promise<StatusResult> {
    return await TurtleApi.clientForUser(user).getAsync('build/status');
  }

}

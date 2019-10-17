import { Command } from 'commander';

import log from '../../log';
import BaseBuilder, { StatusResult } from './BaseBuilder';
import { UserManager, User } from '@expo/xdl';
import { wait } from './utils';

export type Options = {
  platform: 'android' | 'ios';
  type: 'generic' | 'managed';
}


async function buildAction(projectDir: string, options: Options) {
  const user: User = await UserManager.ensureLoggedInAsync();
  const builder = new BaseBuilder(projectDir, user, options);
  const response = await builder.postBuild(projectDir, options);
  const buildArtifactUrl = await wait(user, response.buildId);
  log(`Artifact url: ${buildArtifactUrl}`);
}

async function statusAction(projectDir: string) {
  const user: User = await UserManager.ensureLoggedInAsync();
  const builder = new BaseBuilder(projectDir);
  const result: StatusResult = await builder.getStatusOfLatestBuilds(user);
  result.builds.map(build => log(`platform: ${build.platform},
   status: ${build.status}, artifact url: ${build.artifacts ? build.artifacts.s3Url : 'not available'}.`));
}

export default function (program: Command) {
  program
    .command('build-native [project-dir]')
    .description('Build a standalone APK/IPA or App Bundle for your project, signed and ready for submission to the Google Play Store / App Store.')
    .option('-p --platform <platform>', 'Platform: [android|ios]', /^(android|ios)$/i)
    .option('-t --type <type>', 'Type: [generic|managed|]', /^(generic|managed)$/i)
    .asyncActionProjectDir(buildAction, /* skipProjectValidation: */ true);


  program
    .command('build-native:status [project-dir]')
    .description(`Gets the status of a latest builds for your project.`)
    .asyncActionProjectDir(statusAction, /* skipProjectValidation: */ true);
}

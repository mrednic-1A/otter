import {
  apply,
  chain,
  MergeStrategy,
  mergeWith,
  move,
  renameTemplateFiles,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import {existsSync, readFileSync} from 'node:fs';
import type { PathObject } from '@ama-sdk/core';
import * as path from 'node:path';
import * as semver from 'semver';

import { OpenApiCliOptions } from '../../code-generator/open-api-cli-generator/open-api-cli.options';
import { treeGlob } from '../../helpers/tree-glob';
import { NgGenerateTypescriptSDKCoreSchematicsSchema } from './schema';
import { OpenApiCliGenerator } from '../../code-generator/open-api-cli-generator/open-api-cli.generator';
import { generateOperationFinderFromSingleFile } from './helpers/path-extractor';
import { JsonObject } from 'type-fest';

const getRegexpTemplate = (regexp: RegExp) => `new RegExp('${regexp.toString().replace(/\/(.*)\//, '$1').replace(/\\\//g, '/')}')`;

const getPathObjectTemplate = (pathObj: PathObject) => {
  return `{
      ${
  (Object.keys(pathObj) as (keyof PathObject)[]).map((propName) => {
    const value = (propName) === 'regexp' ? getRegexpTemplate(pathObj[propName]) : JSON.stringify(pathObj[propName]);
    return `${propName as string}: ${value}`;
  }).join(',')
}
    }`;
};

/**
 * Generate a typescript SDK source code base on swagger specification
 * @param options
 */
export function ngGenerateTypescriptSDK(options: NgGenerateTypescriptSDKCoreSchematicsSchema): Rule {

  const specPath = path.resolve(process.cwd(), options.specPath);
  const targetPath = options.directory || '';
  const globalProperty = options.globalProperty;
  const specContent = readFileSync(specPath).toString();
  let jsonSpecContent: JsonObject;
  try {
    jsonSpecContent = JSON.parse(specContent) as JsonObject;
  } catch (e) {
  }

  const generateOperationFinder = async (): Promise<PathObject[]> => {
    const specification: any = jsonSpecContent || (await import('js-yaml')).load(specContent);
    const extraction = generateOperationFinderFromSingleFile(specification);
    return extraction || [];
  };



  /**
   * rule to clear previous SDK generation
   * @param tree
   * @param _context
   */
  const clearGeneratedCode = (tree: Tree, _context: SchematicContext) => {
    treeGlob(tree, path.posix.join(targetPath, 'src', 'api', '**', '*.ts')).forEach((file) => tree.delete(file));
    treeGlob(tree, path.posix.join(targetPath, 'src', 'api', '**', '*.ts')).forEach((file) => tree.delete(file));
    treeGlob(tree, path.posix.join(targetPath, 'src', 'models', 'base', '**', '!(index).ts')).forEach((file) => tree.delete(file));
    treeGlob(tree, path.posix.join(targetPath, 'src', 'spec', '!(operation-adapter|index).ts')).forEach((file) => tree.delete(file));
    return tree;
  };

  /**
   * rule to update readme and generate mandatory code source
   */
  const generateSource = async () => {
    if (!existsSync(specPath)) {
      throw new Error(`${specPath} does not exists`);
    }

    const pathObjects = await generateOperationFinder();
    const swayOperationAdapter = `[${pathObjects.map((pathObj) => getPathObjectTemplate(pathObj)).join(',')}]`;

    return mergeWith(apply(url('./templates'), [
      template({
        ...options,
        swayOperationAdapter,
        empty: ''
      }),
      move(targetPath),
      renameTemplateFiles()
    ]), MergeStrategy.Overwrite);
  };

  /**
   * Update local swagger spec file
   * @param tree
   * @param _context
   */
  const updateSpec = (tree: Tree, _context: SchematicContext) => {
    const readmeFile = path.posix.join(targetPath, 'readme.md');
    if (tree.exists(readmeFile)) {
      const swaggerVersion = /version: ([0-9]+\.[0-9]+\.[0-9]+)/.exec(specContent);

      if (swaggerVersion) {
        const readmeContent = tree.read(readmeFile)!.toString('utf8');
        tree.overwrite(readmeFile, readmeContent.replace(/Based on Swagger spec .*/i, `Based on Swagger spec ${swaggerVersion[1]}`));
      }
    }

    if (tree.exists(path.posix.join(targetPath, 'swagger-spec.yaml'))) {
      tree.overwrite(path.posix.join(targetPath, 'swagger-spec.yaml'), specContent);
    } else {
      tree.create(path.posix.join(targetPath, 'swagger-spec.yaml'), specContent);
    }
    return () => tree;
  };

  const runGeneratorRule = (tree: Tree, context: SchematicContext) => {
    const generatorOptions: Partial<OpenApiCliOptions> = {specPath, globalProperty};
    const packageJsonFile: {openApiSupportedVersion?: string} = JSON.parse((readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'))).toString());
    const packageOpenApiSupportedVersion: string | undefined = packageJsonFile.openApiSupportedVersion?.replace(/\^|~/, '');
    let openApiVersion = '';
    try {
      openApiVersion = (tree.readJson(path.posix.join(targetPath, 'openapitools.json')) as any)?.['generator-cli']?.version;
    } catch {
      context.logger.warn('No openapitools.json file found in the project');
    }
    if (!!packageOpenApiSupportedVersion && semver.valid(packageOpenApiSupportedVersion) && (!packageOpenApiSupportedVersion || !semver.satisfies(openApiVersion, packageOpenApiSupportedVersion))) {
      generatorOptions.generatorVersion = packageOpenApiSupportedVersion;
    }
    if (options.specConfigPath) {
      generatorOptions.specConfigPath = options.specConfigPath;
    }
    return () => (new OpenApiCliGenerator(options)).getGeneratorRunSchematic(generatorOptions, {rootDirectory: options.directory || undefined});
  };

  return chain([
    clearGeneratedCode,
    generateSource,
    updateSpec,
    runGeneratorRule
  ]);
}

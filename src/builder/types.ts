import Joi from 'joi';

export interface IResponseBase {
  summary: string;
  error?: string;
}

export const ResponseBaseSchema = Joi.object<IResponseBase>({
  summary: Joi.string().optional().description('Summary of the user message'),
  error: Joi.string()
    .optional()
    .description(
      'Error message if any if not able to respond to message in the suggested format',
    )
    .allow(null),
});

export enum ComponetType {
  Util = 'util',
  Factory = 'factory',
  Service = 'service',
  UI = 'ui_component',
  Screen = 'screen',
  Config = 'config',
  Model = 'model',
  Layout = 'layout',
  Media = 'media',
}

export interface ICodeComponent {
  name: string;
  type: ComponetType;
  purpose: string;
  path: string;
  dependsOn?: string[];
}

export const CodeComponentSchema = Joi.object<ICodeComponent>({
  name: Joi.string().required().description('Name of the component'),
  type: Joi.string()
    .valid(...Object.values(ComponetType))
    .required()
    .description('Type of the component'),
  purpose: Joi.string().required().description('Purpose of the component'),
  path: Joi.string().required().description('Path of the component'),
  dependsOn: Joi.array()
    .items(Joi.string())
    .optional()
    .description('List of components this component depends on'),
});

export interface IInitializeAppInput {
  userMessage: string;
}

export interface IInitializeAppResponse extends IResponseBase {
  name: string;
  features: string[];
  design: string;
  components: ICodeComponent[];
}

export const InitializeAppResponseSchema = Joi.object<IInitializeAppResponse>({
  name: Joi.string().required().description('Name of the app'),
  features: Joi.array()
    .items(Joi.string())
    .required()
    .description('Minimum features of the app'), //TODO: Generate advanced features after the MVP
  design: Joi.string()
    .required()
    .description('Design of the app as a mermaid diagram'),
  components: Joi.array()
    .items(CodeComponentSchema)
    .required()
    .description('Components of the app'),
  summary: Joi.string().optional().description('Summary of the user message'),
  error: Joi.string()
    .optional()
    .description(
      'Error message if any if not able to respond to message in the suggested format',
    )
    .allow(null),
});

export interface ICodeFile {
  componentName: string;
  filePath: string;
  content: string;
}

export interface IGenerateCodeForComponentInput {
  name: string;
  type: string;
  purpose: string;
  dependencies: IGenerateCodeForComponentResponse[];
  projectStructure?: string;
  design: string;
  techStack: string;
}

export interface IGenerateCodeForComponentResponse extends IResponseBase {
  componentName: string;
  filePath: string;
  content: string;
  assets?: ICodeFile[];
  libraries: string[];
}

export const GenerateCodeForComponentResponseSchema =
  Joi.object<IGenerateCodeForComponentResponse>({
    componentName: Joi.string().required().description('Name of the component'),
    filePath: Joi.string().required().description('File path of the component'),
    content: Joi.string()
      .required()
      .description(
        'Generated code for the component. Escape the string before sending.',
      ),
    assets: Joi.array()
      .optional()
      .items(
        Joi.object<ICodeFile>({
          componentName: Joi.string()
            .required()
            .description('Name of the asset'),
          filePath: Joi.string()
            .required()
            .description('File path of the asset'),
          content: Joi.string()
            .required()
            .description(
              'Content of the asset. Escape the string before sending.',
            ),
        }),
      ),
    libraries: Joi.array()
      .items(Joi.string())
      .optional()
      .description('List of external libraries used in the component'),
    summary: Joi.string().optional().description('Summary of the component'),
    error: Joi.string()
      .optional()
      .description(
        'Error message if any if not able to respond to message in the suggested format',
      )
      .allow(null),
  });

export interface IGenerateCodeResponse extends IResponseBase {
  appName: string;
  features: string[];
  design: string;
  components: ICodeComponent[];
  generatedCode: IGenerateCodeForComponentResponse[];
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

export const UserSchema = Joi.object<IUser>({
  id: Joi.string().required().description('User ID'),
  name: Joi.string().required().description('User name'),
  email: Joi.string().required().description('User email'),
  password: Joi.string().required().description('User password'),
});

export interface IDatabaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DatabaseModelSchema = Joi.object<IDatabaseModel>({
  id: Joi.string().required().description('Model ID'),
  createdAt: Joi.date().required().description('Creation date'),
  updatedAt: Joi.date().required().description('Last update date'),
});

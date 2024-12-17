import Joi from 'joi';
import { z } from 'zod';

export interface IResponseBase {
  summary: string;
  error?: string;
}

export const ZResponseBaseSchema = z.object({
  summary: z.string().describe('Summary of the user message'),
  error: z.string().optional().describe('Error message if any'),
});

export type ZResponseBaseType = z.infer<typeof ZResponseBaseSchema>;

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

export const ZCodeComponentSchema = z.object({
  name: z.string().describe('Name of the component'),
  type: z
    .enum([
      'util',
      'factory',
      'service',
      'ui_component',
      'screen',
      'config',
      'model',
      'layout',
      'media',
    ])
    .describe('Type of the component'),
  purpose: z.string().describe('Purpose of the component'),
  path: z.string().describe('Path of the component'),
  dependsOn: z
    .array(z.string())
    .describe('List of components this component depends on'),
});

export type ZCodeComponentType = z.infer<typeof ZCodeComponentSchema>;

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

export const ZInitializeAppResponseSchema = ZResponseBaseSchema.extend({
  name: z.string().describe('Name of the app'),
  features: z.array(z.string()).describe('Minimum features of the app'), //TODO: Generate advanced features after the MVP
  design: z.string().describe('Design of the app as a mermaid diagram'),
  components: z.array(ZCodeComponentSchema).describe('Components of the app'),
});

export type ZInitializeAppResponseType = z.infer<
  typeof ZInitializeAppResponseSchema
>;

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

export const ZCodeFileSchema = z.object({
  componentName: z.string().describe('Name of the component'),
  filePath: z.string().describe('File path of the component'),
  content: z.string().describe('Code for the component'),
});

export type ZCodeFileType = z.infer<typeof ZCodeFileSchema>;

export interface IGenerateCodeForComponentInput {
  name: string;
  type: ComponetType;
  purpose: string;
  dependencies: IGenerateCodeForComponentResponse[];
  projectStructure?: string;
  design: string;
  techStack: string;
}

export const ZGenerateCodeForComponentInputSchema = z.object({
  name: z.string().describe('Name of the component'),
  type: z
    .enum([
      'util',
      'factory',
      'service',
      'ui_component',
      'screen',
      'config',
      'model',
      'layout',
      'media',
    ])
    .describe('Type of the component'),
  purpose: z.string().describe('Purpose of the component'),
  dependencies: z
    .array(ZCodeFileSchema)
    .describe('Dependencies of the component'),
  projectStructure: z
    .string()
    .optional()
    .describe('Project structure for the app'),
  design: z.string().describe('Design of the app as a mermaid diagram'),
  techStack: z.string().describe('Tech stack to use in the app'),
});

export interface IGenerateCodeForComponentResponse extends IResponseBase {
  componentName: string;
  filePath: string;
  content: string;
  assets?: ICodeFile[];
  libraries: string[];
}

export const ZGenerateCodeForComponentResponseSchema =
  ZResponseBaseSchema.extend({
    componentName: z.string().describe('Name of the component'),
    filePath: z.string().describe('File path of the component'),
    content: z
      .string()
      .describe(
        'Generated code for the component. Escape the string before sending.',
      ),
    assets: z
      .array(ZCodeFileSchema)
      .optional()
      .describe(
        'Any media asset like image, video or sound used in the component',
      ),
    libraries: z
      .array(z.string())
      .describe('List of external libraries used in the component'),
  });

export type ZGenerateCodeForComponentResponseType = z.infer<
  typeof ZGenerateCodeForComponentResponseSchema
>;

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

export const ZGenerateCodeResponseSchema = ZResponseBaseSchema.extend({
  appName: z.string(),
  features: z.array(z.string()),
  design: z.string(),
  components: z.array(ZCodeComponentSchema),
  generatedCode: z.array(ZGenerateCodeForComponentResponseSchema),
});

export type ZGenerateCodeResponseType = z.infer<
  typeof ZGenerateCodeResponseSchema
>;

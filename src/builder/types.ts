import { z } from 'zod';
import { IWebTechStackOptions } from './web/webTechStack';
import { IMobileTechStackOptions } from './mobile/mobileTechStack';
import {
  Backend,
  IBackendConfig, // Import the new config interface
} from './backend/serviceStack';
import { IImageSource } from '../register/tools';

export interface IResponseBase {
  summary: string;
  error?: string | null;
}

export const ZResponseBaseSchema = z.object({
  summary: z.string().describe('Summary of the user message'),
  error: z.string().optional().describe('Error message if any').nullable(),
});

export type ZResponseBaseType = z.infer<typeof ZResponseBaseSchema>;

export enum ComponentType {
  Router = 'router',
  Handler = 'handler',
  Schema = 'schema',
  Util = 'util',
  Hook = 'hook',
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
  type: ComponentType;
  purpose: string;
  path: string;
  dependsOn?: string[];
}

export const ZCodeComponentSchema = z.object({
  name: z.string().describe('Name of the component'),
  type: z
    .nativeEnum(ComponentType)
    .or(z.string())
    .describe('Type of the component'),
  purpose: z.string().describe('Purpose of the component'),
  path: z.string().describe('Path of the component'),
  dependsOn: z
    .array(z.string())
    .describe('List of components this component depends on'),
});

export type ZCodeComponentType = z.infer<typeof ZCodeComponentSchema>;

// TODO: Need to make this generic for all the tech stacks
export interface IBackendDetails {
  type: Backend;
  url: string;
  key: string;
  authConfig?: any;
  types?: string;
  docs?: string;
}

export interface IInitializeAppInput {
  techStack: IWebTechStackOptions | IMobileTechStackOptions;
}

export interface IInitializeAppResponse extends IResponseBase {
  name: string;
  features: string[];
  design: string;
  components: ICodeComponent[];
}

export const ZInitializeAppResponseSchema = ZResponseBaseSchema.extend({
  name: z.string().describe('Name of the app'),
  title: z.string().describe('Title of the app'),
  features: z.array(z.string()).describe('Minimum features of the app'), //TODO: Generate advanced features after the MVP
  architecture: z
    .string()
    .describe('Architecture of the app as a mermaid diagram'),
  design: z
    .string()
    .describe('Design elements used in the app like colors, fonts, etc.'),
  components: z.array(ZCodeComponentSchema).describe('Components of the app'),
  sqlScripts: z
    .string()
    .optional()
    .describe('SQL scripts for the app')
    .nullable(),
});

export type ZInitializeAppResponseType = z.infer<
  typeof ZInitializeAppResponseSchema
>;

export const ZInitializeAppWithBackendResponseSchema =
  ZInitializeAppResponseSchema.extend({
    sqlScripts: z.string().describe('SQL scripts for the app'),
  });

export type ZInitializeAppWithBackendResponseType = z.infer<
  typeof ZInitializeAppWithBackendResponseSchema
>;

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
  path: string;
  type: ComponentType;
  purpose: string;
  dependencies: ZGenerateCodeForComponentResponseType[];
  projectStructure?: string;
  architecture: string;
  design: string;
  techStack: IMobileTechStackOptions | IWebTechStackOptions;
}

export const ZGenerateCodeForComponentInputSchema = z.object({
  name: z.string().describe('Name of the component'),
  type: z
    .nativeEnum(ComponentType)
    .or(z.string())
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

export interface IGenerateCodeResponse extends IResponseBase {
  appName: string;
  features: string[];
  design: string;
  components: ICodeComponent[];
  generatedCode: ZGenerateCodeForComponentResponseType[];
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

export interface IGenericStack {
  stateManagement: string;
  uiLibrary: string;
  testing: string[];
  backendConfig: IBackendConfig;
  designConfig: {
    figmaFileUrl?: string;
    theme?: string;
    images?: IImageSource[];
    description?: string;
  };
}

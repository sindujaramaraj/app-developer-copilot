import {
  AuthenticationMethod,
  Backend,
  getPromptForBackend,
} from '../backend/serviceStack';
import { IGenericStack } from '../types';

export enum MobilePlatform {
  expo = 'expo',
}

export enum MobileFramework {
  REACT_NATIVE = 'react-native',
  FLUTTER = 'flutter',
}

export enum StateManagement {
  REDUX = 'redux',
  ZUSTAND = 'zustand',
  MOBX = 'mobx',
  RECOIL = 'recoil',
  JOTAI = 'jotai',
}

export enum UILibrary {
  REACT_NATIVE_PAPER = 'react-native-paper',
  NATIVE_BASE = 'native-base',
  TAMAGUI = 'tamagui',
  RESTYLE = '@shopify/restyle',
}

export enum Navigation {
  EXPO_ROUTER = 'expo-router',
  REACT_NAVIGATION = '@react-navigation/native',
}

export enum Testing {
  JEST = 'jest',
  TESTING_LIBRARY = '@testing-library/react-native',
  DETOX = 'detox',
}

export enum Storage {
  ASYNC_STORAGE = '@react-native-async-storage/async-storage',
  MMKV = 'react-native-mmkv',
  REALM = '@realm/react',
}

export interface IMobileTechStackOptions extends IGenericStack {
  platform: MobilePlatform;
  framework: MobileFramework;
  stateManagement: StateManagement;
  uiLibrary: UILibrary;
  navigation: Navigation;
  testing: Testing[];
  storage: Storage;
}

export const DEFAULT_MOBILE_STACK: IMobileTechStackOptions = {
  platform: MobilePlatform.expo,
  framework: MobileFramework.REACT_NATIVE,
  stateManagement: StateManagement.ZUSTAND,
  uiLibrary: UILibrary.REACT_NATIVE_PAPER,
  navigation: Navigation.EXPO_ROUTER,
  testing: [Testing.JEST, Testing.TESTING_LIBRARY],
  storage: Storage.ASYNC_STORAGE,
  backendConfig: {
    backend: Backend.SUPABASE,
    useExisting: false,
    authentication: AuthenticationMethod.EMAIL,
  },
  designConfig: {},
};

export const getDefaultMobileTechStack = (): IMobileTechStackOptions => {
  return DEFAULT_MOBILE_STACK;
};

export const getLibsToInstallForStack = (
  stack: IMobileTechStackOptions,
): string[] => {
  const libs = [];
  switch (stack.stateManagement) {
    case StateManagement.REDUX:
      libs.push('redux', 'react-redux');
      break;
    case StateManagement.ZUSTAND:
      libs.push('zustand');
      break;
    case StateManagement.MOBX:
      libs.push('mobx', 'mobx-react-lite');
      break;
    case StateManagement.RECOIL:
      libs.push('recoil');
      break;
    case StateManagement.JOTAI:
      libs.push('jotai');
      break;
  }

  switch (stack.uiLibrary) {
    case UILibrary.REACT_NATIVE_PAPER:
      libs.push('react-native-paper');
      break;
    case UILibrary.NATIVE_BASE:
      libs.push('native-base');
      libs.push('normalize-css-color');
      break;
    case UILibrary.TAMAGUI:
      libs.push('tamagui');
      libs.push('@tamagui/themes');
      break;
    case UILibrary.RESTYLE:
      libs.push('@shopify/restyle');
      break;
  }

  switch (stack.navigation) {
    case Navigation.EXPO_ROUTER:
      libs.push('expo-router');
      break;
    case Navigation.REACT_NAVIGATION:
      libs.push('@react-navigation/native');
      break;
  }
  const { backend } = stack.backendConfig;
  switch (backend) {
    case Backend.SUPABASE:
      libs.push('@supabase/supabase-js');
      libs.push('@react-native-async-storage/async-storage');
      libs.push('react-native-url-polyfill');
      break;
  }

  // TODO: Add testing libraries and authentication libraries

  return libs;
};

export const getPromptForMobileStack = (
  stack: IMobileTechStackOptions,
): string => {
  return `For the expo app, use ${stack.stateManagement} for state management,\
   ${stack.uiLibrary} for UI components library, \
   ${stack.navigation} for navigation, \
   and ${stack.storage} for local device storage.\
   ${getPromptForBackend(stack.backendConfig)}
   `;
};

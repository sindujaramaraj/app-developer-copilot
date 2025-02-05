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

export enum DataFetching {
  REACT_QUERY = '@tanstack/react-query',
  APOLLO = '@apollo/client',
  RTK_QUERY = '@reduxjs/toolkit/query',
  SWR = 'swr',
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

export enum Authentication {
  EXPO_AUTH = 'expo-auth-session',
  FIREBASE = '@react-native-firebase/auth',
  CLERK = '@clerk/clerk-expo',
  SUPABASE = '@supabase/supabase-js',
}

export interface TechStackOptions {
  stateManagement: StateManagement;
  uiLibrary: UILibrary;
  navigation: Navigation;
  dataFetching?: DataFetching;
  testing: Testing[];
  storage: Storage;
  authentication?: Authentication;
}

export const DEFAULT_STACK: TechStackOptions = {
  stateManagement: StateManagement.ZUSTAND,
  uiLibrary: UILibrary.REACT_NATIVE_PAPER,
  navigation: Navigation.EXPO_ROUTER,
  testing: [Testing.JEST, Testing.TESTING_LIBRARY],
  storage: Storage.ASYNC_STORAGE,
};

export const getDefaultStack = (): TechStackOptions => {
  return DEFAULT_STACK;
};

export const getPromptForStackComplete = (stack: TechStackOptions): string => {
  return `Use ${stack.stateManagement} for state management,
  ${stack.uiLibrary} for UI, ${stack.navigation} for navigation,
  ${stack.dataFetching} for data fetching,
  ${stack.testing} for testing,
  ${stack.storage} for storage,
  and ${stack.authentication} for authentication.`;
};

export const getPromptForStack = (stack: TechStackOptions): string => {
  return `Use ${stack.stateManagement} for state management, ${stack.uiLibrary} for UI, ${stack.navigation} for navigation, ${stack.dataFetching} for data fetching, and ${stack.storage} for storage.`;
};

export class MobileTechStack {
  private stateManagement: StateManagement;
  private uiLibrary: UILibrary;
  private navigation: Navigation;
  private dataFetching?: DataFetching;
  private testing: Testing[];
  private storage: Storage;
  private authentication?: Authentication;

  constructor(options: TechStackOptions) {
    this.stateManagement = options.stateManagement;
    this.uiLibrary = options.uiLibrary;
    this.navigation = options.navigation;
    this.dataFetching = options.dataFetching;
    this.testing = options.testing;
    this.storage = options.storage;
    this.authentication = options.authentication;
  }

  public getStateManagement(): StateManagement {
    return this.stateManagement;
  }

  public getUILibrary(): UILibrary {
    return this.uiLibrary;
  }

  public getNavigation(): Navigation {
    return this.navigation;
  }

  public getDataFetching(): DataFetching | undefined {
    return this.dataFetching;
  }

  public getTesting(): Testing[] {
    return this.testing;
  }

  public getStorage(): Storage {
    return this.storage;
  }

  public getAuthentication(): Authentication | undefined {
    return this.authentication;
  }
}

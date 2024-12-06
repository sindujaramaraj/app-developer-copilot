import { DefaultTheme, DarkTheme } from 'react-native-paper';
import { Theme } from 'react-native-paper/lib/typescript/types';

export const lightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6200ee',
    accent: '#03dac4',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#000000',
    disabled: '#f0f0f0',
    placeholder: '#a0a0a0',
    backdrop: '#f0f0f0',
  },
};

export const darkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#bb86fc',
    accent: '#03dac4',
    background: '#121212',
    surface: '#121212',
    text: '#ffffff',
    disabled: '#303030',
    placeholder: '#a0a0a0',
    backdrop: '#303030',
  },
};

export const customTheme = (primaryColor: string, accentColor: string): Theme => ({
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: primaryColor,
    accent: accentColor,
    background: '#ffffff',
    surface: '#ffffff',
    text: '#000000',
    disabled: '#f0f0f0',
    placeholder: '#a0a0a0',
    backdrop: '#f0f0f0',
  },
});

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { theme } from '../utils/theme';
import { rs } from '../utils/responsive';

export default function Heading({ level = 'title', style, children, ...props }) {
  const size = theme.fontSize[level] || theme.fontSize.title;
  
  return (
    <Text 
      style={[
        styles.heading, 
        { fontSize: rs(size) },
        style
      ]} 
      {...props}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: theme.fontFamily.headline,
    color: theme.colors.textPrimary,
  },
});

declare module '*.jsx' {
  import React from 'react';
  const Component: React.ComponentType<Record<string, unknown>>;
  export default Component;
}
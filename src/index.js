import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import theme from './theme/index'

// Import thirdweb provider and Goerli ChainId
import { ThirdwebProvider } from '@thirdweb-dev/react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react'

import { ChainId } from '@thirdweb-dev/sdk';

// This is the chainId your dApp will work on.
const activeChainId = ChainId.Mumbai;

// Wrap your app with the thirdweb provider
const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    {/* <ChakraProvider theme={theme}> */}
      <ThirdwebProvider
      desiredChainId={activeChainId}
      dAppMeta={{
        name: "ZeroCarbon DAO",
        description: "Offset your carbon emissions",
        isDarkMode: false,
        logoUrl: "https://example.com/logo.png",
        url: "https://example.com",
      }}>
        
          <App />
      </ThirdwebProvider>
    {/* </ChakraProvider> */}
  </React.StrictMode>,
);

/**
 * mlg-meta-mcp
 *
 * MCP Server for Meta Ads with automatic account discovery and multi-endpoint support.
 *
 * @author malego
 * @license MIT
 */

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config/index.js';
import { getLogger } from './utils/logger.js';
import { initializeHandlers, handleToolCall } from './tools/handlers.js';
import { getAllTools } from './tools/index.js';
import { MetaMcpError, ErrorCategory } from './utils/errors.js';

const logger = getLogger();

async function main(): Promise<void> {
  if (!config.META_SYSTEM_USER_TOKEN) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'META_SYSTEM_USER_TOKEN is required to start the MCP server'
    );
  }

  logger.info({ version: '0.1.0' }, 'Starting mlg-meta-mcp server');
  logger.info(
    {
      apiVersion: config.META_API_VERSION,
      logLevel: config.LOG_LEVEL,
      cacheTTL: config.CACHE_TTL_SECONDS,
      maxRetries: config.MAX_RETRIES,
    },
    'Configuration loaded'
  );

  // Initialize handlers with System User Token
  try {
    initializeHandlers(config.META_SYSTEM_USER_TOKEN);
    logger.info('All services initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize handlers');
    process.exit(1);
  }

  // Test connection to Meta API (optional validation)
  try {
    logger.info('Testing connection to Meta API...');
    logger.info('Connection test deferred to first API call');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Meta API');
    process.exit(1);
  }

  // Create MCP Server
  const server = new Server(
    {
      name: 'mlg-meta-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handler: List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Received ListToolsRequest');
    return {
      tools: getAllTools(), //arr of tools in tools/index.ts
    };
  });

  // Handler: Execute a tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info({ tool: name }, 'Executing tool');

    try {
      const result = await handleToolCall(name, args);

      if (result.isError) {
        logger.warn({ tool: name }, 'Tool returned error');
      } else {
        logger.info({ tool: name }, 'Tool executed successfully');
      }

      return result;
    } catch (error) {
      logger.error({ tool: name, error }, 'Unexpected tool execution error');

      const errorMessage =
        error instanceof MetaMcpError
          ? error.message
          : `Unexpected error: ${(error as Error).message}`;

      return {
        content: [
          {
            type: 'text',
            text: `${ErrorCategory.UNKNOWN} ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Server ready. Listening for MCP requests');
  logger.info('');
  logger.info('Available tools:');
  const tools = getAllTools();
  tools.forEach((tool) => {
    logger.info(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

// Run main
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error starting server');
  process.exit(1);
});

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_CLIENT, AnthropicAiClient, FakeAiClient } from './ai-client.js';

/** Global: los módulos de IA piden `@Inject(AI_CLIENT)`. */
@Global()
@Module({
  providers: [
    {
      provide: AI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('ANTHROPIC_API_KEY');
        if (apiKey) return new AnthropicAiClient(apiKey, config.get<string>('AI_MODEL') || 'claude-sonnet-5-5');
        // En producción sin llave no se inventan respuestas: los módulos muestran que falta activarlo.
        if (config.get<string>('NODE_ENV') === 'production') return null;
        return new FakeAiClient();
      },
    },
  ],
  exports: [AI_CLIENT],
})
export class AiModule {}

import { NestFactory } from '@nestjs/core';
import { HTTP } from './common/constants';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { globalValidationPipe } from './common/pipes/validation.pipe';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(LoggerService);
  // Route all NestJS internal logs (module init, bootstrap, unhandled exceptions) through pino
  app.useLogger(logger);

  const config = app.get(ConfigService);

  app.setGlobalPrefix(HTTP.API_PREFIX);
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableCors({ origin: config.get<string>('FRONTEND_URL') });

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);

  logger.log(`Application running on port ${port}`, 'Bootstrap');
}

bootstrap();

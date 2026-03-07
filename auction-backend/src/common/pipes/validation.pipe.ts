import { ValidationPipe } from '@nestjs/common';

/**
 * Project-standard ValidationPipe configuration.
 * - whitelist: strips properties not in the DTO class
 * - forbidNonWhitelisted: throws 400 if unknown properties are sent
 * - transform: auto-converts primitives to their DTO types
 */
export const globalValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

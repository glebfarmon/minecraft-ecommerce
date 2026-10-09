import {BadRequestException, type PipeTransform} from '@nestjs/common'
import * as v from 'valibot'

/** Validates a request part against a Valibot schema from @shop/shared (parent spec §5). */
export class ValibotPipe<S extends v.GenericSchema> implements PipeTransform<
  unknown,
  v.InferOutput<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): v.InferOutput<S> {
    const result = v.safeParse(this.schema, value)
    if (result.success) return result.output
    throw new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      issues: v.flatten(result.issues)
    })
  }
}

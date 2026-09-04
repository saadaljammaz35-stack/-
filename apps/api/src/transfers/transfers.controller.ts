import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { type CurrencyCode, ENABLED_CURRENCIES, Money } from '@nabd/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TransfersService } from './transfers.service.js';

export class CreateTransferDto {
  @IsString()
  @Length(1, 64)
  senderAccountId!: string;

  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @IsOptional()
  @IsString()
  @Length(6, 34)
  recipientAccountNumber?: string;

  /**
   * Minor units, as an integer — 100.00 SAR is 10000.
   *
   * The API takes minor units rather than a decimal string so no float ever
   * appears on the wire. `@IsInt` rejects "100.50" outright rather than
   * rounding a customer's amount to something they did not ask for.
   */
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsEnum(ENABLED_CURRENCIES as unknown as object)
  currency!: CurrencyCode;

  @IsOptional()
  @IsString()
  @Length(0, 140)
  description?: string;
}

interface AuthedRequest {
  user: { id: string; sessionId: string; amr?: string[] };
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transfer' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'A client-generated unique key. Replaying a request with the same key ' +
      'returns the original result and never posts a second time.',
  })
  @ApiResponse({ status: 201, description: 'Transfer completed or queued for review' })
  @ApiResponse({ status: 409, description: 'Duplicate or in-flight request' })
  @ApiResponse({
    status: 422,
    description: 'Insufficient funds, limit exceeded, or invalid',
  })
  async create(
    @Body() dto: CreateTransferDto,
    @Req() request: AuthedRequest,
  ): Promise<Record<string, unknown>> {
    const idempotencyKey = String(request.headers['idempotency-key']);

    const result = await this.transfers.create({
      userId: request.user.id,
      senderAccountId: dto.senderAccountId,
      ...(dto.beneficiaryId === undefined ? {} : { beneficiaryId: dto.beneficiaryId }),
      ...(dto.recipientAccountNumber === undefined
        ? {}
        : { recipientAccountNumber: dto.recipientAccountNumber }),
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      ...(dto.description === undefined ? {} : { description: dto.description }),
      idempotencyKey,
      context: {
        ...(request.ip === undefined ? {} : { ip: request.ip }),
        isNewDevice: false,
        isNewCountry: false,
        ipIsAnonymised: false,
        // Set by the step-up guard once an OTP or biometric challenge passes.
        strongAuthSatisfied: request.user.amr?.includes('otp') === true,
      },
    });

    return {
      transactionId: result.transactionId,
      reference: result.reference,
      status: result.status,
      amount: Money.fromMinor(BigInt(dto.amountMinor), dto.currency).toJSON(),
    };
  }

  @Get()
  @ApiOperation({ summary: "List the caller's transfers" })
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<Record<string, unknown>> {
    return {
      userId: request.user.id,
      limit: limit ?? '25',
      cursor: cursor ?? null,
      items: [],
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one transfer' })
  async get(@Param('id') id: string): Promise<Record<string, unknown>> {
    return { id };
  }
}

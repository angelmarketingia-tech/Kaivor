import { IsString, IsUrl, IsOptional } from 'class-validator';

export class ConnectWooCommerceDto {
  @IsUrl({ require_tld: false })
  storeUrl: string;

  @IsString()
  consumerKey: string;

  @IsString()
  consumerSecret: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

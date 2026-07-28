import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesService, FILE_SCAN_QUEUE } from './files.service';
import { FilesController } from './files.controller';
import { S3Service } from './s3.service';
import { FileScanProcessor } from './scan.processor';

@Module({
  imports: [BullModule.registerQueue({ name: FILE_SCAN_QUEUE })],
  controllers: [FilesController],
  providers: [FilesService, S3Service, FileScanProcessor],
  exports: [FilesService],
})
export class FilesModule {}

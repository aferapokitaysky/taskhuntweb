import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto';
import { UpdatePortfolioItemDto } from './dto/update-portfolio-item.dto';
import { CreateBidTemplateDto } from './dto/create-bid-template.dto';
import { UpdateBidTemplateDto } from './dto/update-bid-template.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Get('me/previous-freelancers')
  listPreviousFreelancers(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listPreviousFreelancers(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/export')
  async exportMyData(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const data = await this.usersService.exportUserData(user.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="taskhunt-data.json"');
    res.send(JSON.stringify(data, null, 2));
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Delete('me')
  deleteMyAccount(@CurrentUser() user: AuthenticatedUser, @Body('password') password: string) {
    return this.usersService.deleteAccount(user.id, password);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/onboarding')
  submitOnboarding(@CurrentUser() user: AuthenticatedUser, @Body() dto: OnboardingDto) {
    return this.usersService.submitOnboarding(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.uploadAvatar(user.id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/portfolio')
  addPortfolioItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePortfolioItemDto) {
    return this.usersService.addPortfolioItem(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/portfolio/:id')
  updatePortfolioItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioItemDto,
  ) {
    return this.usersService.updatePortfolioItem(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/portfolio/:id')
  deletePortfolioItem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deletePortfolioItem(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/bid-templates')
  listBidTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listBidTemplates(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/bid-templates')
  createBidTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBidTemplateDto) {
    return this.usersService.createBidTemplate(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/bid-templates/:id')
  updateBidTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBidTemplateDto,
  ) {
    return this.usersService.updateBidTemplate(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/bid-templates/:id')
  deleteBidTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deleteBidTemplate(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('saved/freelancers')
  listSavedFreelancers(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listSavedFreelancers(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  saveFreelancer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.saveFreelancer(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/favorite')
  unsaveFreelancer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.unsaveFreelancer(user.id, id);
  }

  @Get(':id/avatar')
  async getAvatar(@Param('id') id: string, @Res() res: Response) {
    const avatar = await this.usersService.getAvatar(id);
    res.setHeader('Content-Type', avatar.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(avatar.data);
  }

  @Get(':id')
  getPublicProfile(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.usersService.getPublicProfile(id, user?.id);
  }
}

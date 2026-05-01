import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/guards/firebase-auth.guard';

@Controller()
export class MembershipsController {
  constructor(private readonly svc: MembershipsService) {}

  /** GET /api/v1/organizations/me/members */
  @Get('organizations/me/members')
  listMembers(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.listMembers(user.uid);
  }

  /** POST /api/v1/organizations/me/members/invite */
  @Post('organizations/me/members/invite')
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InviteMemberDto,
  ) {
    return this.svc.inviteMember(user.uid, dto);
  }

  /** PATCH /api/v1/organizations/me/members/:membershipId */
  @Patch('organizations/me/members/:membershipId')
  @HttpCode(HttpStatus.OK)
  updateMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.svc.updateMember(user.uid, membershipId, dto);
  }

  /** DELETE /api/v1/organizations/me/members/:membershipId */
  @Delete('organizations/me/members/:membershipId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('membershipId') membershipId: string,
  ) {
    return this.svc.removeMember(user.uid, membershipId);
  }

  // ─── Invitaciones ─────────────────────────────────────────────────────────

  /** GET /api/v1/invitations/:token  (pública) */
  @Public()
  @Get('invitations/:token')
  getInvitationInfo(@Param('token') token: string) {
    return this.svc.getInvitationInfo(token);
  }

  /** POST /api/v1/invitations/:token/accept */
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.svc.acceptInvitation(token, user.uid);
  }

  /** DELETE /api/v1/organizations/me/invitations/:invitationId */
  @Delete('organizations/me/invitations/:invitationId')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('invitationId') invitationId: string,
  ) {
    return this.svc.revokeInvitation(user.uid, invitationId);
  }
}

import { StatusCodes } from 'http-status-codes'
import { QueryRunner } from 'typeorm'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { Platform } from '../../Interface'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { OrganizationUser, OrganizationUserStatus } from '../../enterprise/database/entities/organization-user.entity'
import { Organization, OrganizationName } from '../../enterprise/database/entities/organization.entity'
import { GeneralRole } from '../../enterprise/database/entities/role.entity'
import { User, UserStatus } from '../../enterprise/database/entities/user.entity'
import { WorkspaceUser, WorkspaceUserStatus } from '../../enterprise/database/entities/workspace-user.entity'
import { Workspace, WorkspaceName } from '../../enterprise/database/entities/workspace.entity'
import { IAssignedWorkspace, LoggedInUser } from '../../enterprise/Interface.Enterprise'
import { OrganizationUserService } from '../../enterprise/services/organization-user.service'
import { OrganizationService } from '../../enterprise/services/organization.service'
import { RoleService } from '../../enterprise/services/role.service'
import { UserErrorMessage, UserService } from '../../enterprise/services/user.service'
import { WorkspaceUserService } from '../../enterprise/services/workspace-user.service'
import { WorkspaceService } from '../../enterprise/services/workspace.service'

export interface ExternalIdentity {
    email: string
    name: string
    ssoProvider: string
    ssoSubjectId: string
}

const workspaceNameFor = (name: string, email: string): string => {
    const base = (name || email.split('@')[0] || 'user').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (base === WorkspaceName.DEFAULT_WORKSPACE || base === WorkspaceName.DEFAULT_PERSONAL_WORKSPACE) {
        return `${base} User`.slice(0, 100)
    }
    return base || 'user'
}

const buildLoggedInUser = async (user: User, queryRunner: QueryRunner): Promise<LoggedInUser> => {
    const app = getRunningExpressApp()
    const workspaceUserService = new WorkspaceUserService()
    const organizationUserService = new OrganizationUserService()
    const roleService = new RoleService()
    const orgService = new OrganizationService()

    const workspaceUsers = await workspaceUserService.readWorkspaceUserByUserId(user.id, queryRunner)
    if (!workspaceUsers.length) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'No workspace is assigned to this user')
    }
    const workspaceUser = workspaceUsers.find((item) => item.lastLogin) || workspaceUsers[workspaceUsers.length - 1]
    const { organizationUser } = await organizationUserService.readOrganizationUserByWorkspaceIdUserId(
        workspaceUser.workspaceId,
        workspaceUser.userId,
        queryRunner
    )
    if (!organizationUser) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Organization membership was not found')
    }
    const ownerRole = await roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)
    const role = await roleService.readRoleById(workspaceUser.roleId, queryRunner)
    if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role not found')
    const organization = await orgService.readOrganizationById(organizationUser.organizationId, queryRunner)
    if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Organization not found')

    const assignedWorkspaces: IAssignedWorkspace[] = workspaceUsers.map((item) => ({
        id: item.workspace.id,
        name: item.workspace.name,
        role: item.role?.name || '',
        organizationId: item.workspace.organizationId || ''
    }))
    const subscriptionId = (organization.subscriptionId as string) || ''
    const customerId = (organization.customerId as string) || ''
    const features = await app.identityManager.getFeaturesByPlan(subscriptionId)
    const productId = await app.identityManager.getProductIdFromSubscription(subscriptionId)
    let permissions: string[] = []
    try {
        permissions = JSON.parse(role.permissions || '[]')
    } catch {
        permissions = []
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: workspaceUser.roleId,
        activeOrganizationId: organization.id,
        activeOrganizationSubscriptionId: subscriptionId,
        activeOrganizationCustomerId: customerId,
        activeOrganizationProductId: productId,
        isOrganizationAdmin: organizationUser.roleId === ownerRole.id,
        activeWorkspaceId: workspaceUser.workspaceId,
        activeWorkspace: workspaceUser.workspace.name,
        assignedWorkspaces,
        permissions,
        features,
        ssoProvider: user.ssoProvider || undefined
    }
}

/**
 * Map an external identity onto a Flowise user and a workspace that other users do not share.
 * The first user becomes the organization owner. Later users join that organization with their own workspace.
 */
export const provisionExternalUser = async (identity: ExternalIdentity): Promise<LoggedInUser> => {
    const app = getRunningExpressApp()
    const queryRunner = app.AppDataSource.createQueryRunner()
    await queryRunner.connect()
    const userService = new UserService()
    const organizationService = new OrganizationService()
    const organizationUserService = new OrganizationUserService()
    const workspaceService = new WorkspaceService()
    const workspaceUserService = new WorkspaceUserService()
    const roleService = new RoleService()

    try {
        await queryRunner.startTransaction()
        const platform = app.identityManager.getPlatformType()
        let user = await userService.readUserByEmail(identity.email, queryRunner)

        if (!user && platform === Platform.CLOUD) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'New registrations are currently closed.')
        }

        if (user) {
            if (user.status === UserStatus.INVITED) {
                throw new InternalFlowiseError(StatusCodes.FORBIDDEN, UserErrorMessage.USER_INVITED_PENDING_ACTIVATION)
            }
            if (user.ssoProvider && user.ssoSubjectId) {
                if (user.ssoProvider !== identity.ssoProvider || user.ssoSubjectId !== identity.ssoSubjectId) {
                    throw new InternalFlowiseError(StatusCodes.FORBIDDEN, UserErrorMessage.SSO_IDENTITY_MISMATCH)
                }
            } else if (identity.ssoProvider !== 'auth-bypass') {
                await userService.bindSSOIdentity(user.id, identity.ssoProvider, identity.ssoSubjectId, queryRunner)
                user.ssoProvider = identity.ssoProvider
                user.ssoSubjectId = identity.ssoSubjectId
            }
        } else {
            const organizations = await organizationService.readOrganization(queryRunner)
            const organization = organizations[0]
            const isFirstUser = !organization
            const ownerRole = await roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)
            const memberRole = await roleService.readGeneralRoleByName(GeneralRole.MEMBER, queryRunner)
            const personalRole = await roleService.readGeneralRoleByName(GeneralRole.PERSONAL_WORKSPACE, queryRunner)
            const orgRole = isFirstUser ? ownerRole : memberRole

            const created = await userService.createNewUser(
                {
                    email: identity.email,
                    name: identity.name.slice(0, 100),
                    status: UserStatus.ACTIVE,
                    ssoProvider: identity.ssoProvider === 'auth-bypass' ? undefined : identity.ssoProvider,
                    ssoSubjectId: identity.ssoProvider === 'auth-bypass' ? undefined : identity.ssoSubjectId
                },
                queryRunner
            )
            user = await userService.saveUser(created, queryRunner)

            let savedOrganization: Organization
            if (organization) {
                savedOrganization = organization
            } else {
                const createdOrg = organizationService.createNewOrganization(
                    { name: OrganizationName.DEFAULT_ORGANIZATION, createdBy: user.id },
                    queryRunner,
                    true
                )
                savedOrganization = await organizationService.saveOrganization(createdOrg, queryRunner)
            }

            const orgUser = organizationUserService.createNewOrganizationUser(
                {
                    organizationId: savedOrganization.id,
                    userId: user.id,
                    roleId: orgRole.id,
                    status: OrganizationUserStatus.ACTIVE,
                    createdBy: user.id
                } as Partial<OrganizationUser>,
                queryRunner
            )
            await organizationUserService.saveOrganizationUser(orgUser, queryRunner)

            const createdWorkspace = workspaceService.createNewWorkspace(
                {
                    name: workspaceNameFor(identity.name, identity.email),
                    organizationId: savedOrganization.id,
                    createdBy: user.id
                } as Partial<Workspace>,
                queryRunner,
                false
            )
            const savedWorkspace = await workspaceService.saveWorkspace(createdWorkspace, queryRunner)
            const workspaceUser = workspaceUserService.createNewWorkspaceUser(
                {
                    workspaceId: savedWorkspace.id,
                    userId: user.id,
                    roleId: personalRole.id,
                    status: WorkspaceUserStatus.ACTIVE,
                    createdBy: user.id,
                    lastLogin: new Date().toISOString()
                } as Partial<WorkspaceUser>,
                queryRunner
            )
            await workspaceUserService.saveWorkspaceUser(workspaceUser, queryRunner)
        }

        if (!user?.id) throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, 'User provisioning failed')
        const existingWorkspaces = await workspaceUserService.readWorkspaceUserByUserId(user.id, queryRunner)
        if (!existingWorkspaces.length) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'No workspace is assigned to this user')
        }

        const loggedInUser = await buildLoggedInUser(user, queryRunner)
        await queryRunner.commitTransaction()
        return loggedInUser
    } catch (error) {
        if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
        throw error
    } finally {
        if (!queryRunner.isReleased) await queryRunner.release()
    }
}

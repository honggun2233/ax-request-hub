export type Role =
  | 'EMPLOYEE'
  | 'DEPT_HEAD'
  | 'AX_TEAM'
  | 'C_LEVEL'
  | 'EXECUTIVE'
  | 'DATA_PLATFORM'

export type SessionUser = {
  id: string
  employeeId: string
  email: string
  name: string
  role: Role
  department: string
}

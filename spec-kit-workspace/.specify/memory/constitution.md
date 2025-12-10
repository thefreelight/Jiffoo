# Jiffoo E-commerce Platform Constitution

## Core Principles

### I. Multi-Tenant Architecture First
Every new feature must respect tenant isolation and data segregation. All database queries must include tenant context. No cross-tenant data leakage is acceptable. Features must work seamlessly across all three frontends (Mall, Admin, Super-Admin).

### II. TypeScript-First Development
All new code must be written in TypeScript with strict type checking enabled. Shared types must be defined in the `shared` package. API contracts must be type-safe between frontend and backend.

### III. Test-Driven Development (NON-NEGOTIABLE)
TDD is mandatory: Write tests → Get user approval → Watch tests fail → Then implement. Focus on integration tests for API endpoints and component tests for React components. All new features require 80%+ test coverage.

### IV. API-First Design
All features start with API design using OpenAPI/Swagger specifications. Backend APIs must be RESTful and follow consistent patterns. Frontend applications consume APIs through the unified shared client library.

### V. Performance & Scalability
New features must not degrade existing performance. Database queries must be optimized with proper indexing. Frontend components must be optimized for rendering performance. Consider caching strategies for frequently accessed data.

## Technology Stack Standards

### Required Technologies
- **Backend**: Fastify 4.24+ with TypeScript, Prisma ORM, PostgreSQL, Redis
- **Frontend**: Next.js 15+, React 18+, TailwindCSS, Radix UI components
- **Package Management**: pnpm workspace with Turborepo for builds
- **Authentication**: JWT with httpOnly cookies, role-based permissions
- **Database**: PostgreSQL with proper indexing and query optimization

### Forbidden Practices
- No direct database access bypassing Prisma ORM
- No hardcoded tenant IDs or cross-tenant queries
- No inline styles (use TailwindCSS classes)
- No untyped API responses or requests

## Development Workflow

### Feature Development Process
1. **Specification**: Use `/specify` command to define requirements
2. **Planning**: Use `/plan` command for technical implementation
3. **Task Breakdown**: Use `/tasks` command for actionable items
4. **Implementation**: Use `/implement` command with TDD approach
5. **Integration**: Test across all three frontend applications

### Code Review Requirements
- All PRs must pass TypeScript compilation
- All tests must pass (unit, integration, e2e)
- Security review for tenant isolation
- Performance impact assessment
- Documentation updates for API changes

## Governance

This constitution supersedes all other development practices. All new features must comply with these principles. Any deviation requires explicit justification and approval. Use this constitution as the foundation for all technical decisions and implementation choices.

**Version**: 1.0.0 | **Ratified**: 2025-09-20 | **Last Amended**: 2025-09-20
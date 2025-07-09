# Jiffoo Mall - Project Requirements Document

## Project Overview

### Project Name and Description
**Project Name**: Jiffoo Mall - Modern E-commerce Platform  
**Description**: A full-stack e-commerce platform built with modern technology stack, featuring frontend-backend separation architecture, plugin extensibility, and multilingual support.

### Current Project Status
**Status**: 🚀 **In Development** (v0.2.0-beta)
- Core functionality completed and tested
- Commercial features being refined
- Preparing for production deployment

### Target Users and Core Use Cases
**Target Users**:
- Small to medium-sized e-commerce businesses
- Independent developers and startup teams
- Enterprises requiring customized e-commerce solutions
- SaaS service providers

**Core Use Cases**:
- Online product sales and management
- Order processing and inventory management
- User permissions and multi-tenant management
- Plugin ecosystem and extension development
- Multilingual internationalization support

## Development Standards and Requirements

### Language and Documentation Standards
**IMPORTANT**: This project follows strict English-only standards for all public-facing content:

1. **README Documentation**: Must be in English only
   - No Chinese content allowed in README.md
   - All documentation should be accessible to international developers
   - Technical descriptions must use English terminology

2. **Commit Messages**: Must be in English only
   - Use conventional commit format: `type(scope): description`
   - Examples: `feat(auth): add OAuth login support`, `fix(api): resolve payment gateway issue`
   - No Chinese characters in commit messages

3. **Code Comments**: English preferred for public repositories
   - Use clear, descriptive English comments
   - API documentation must be in English
   - Error messages should be in English

4. **Issue and PR Descriptions**: English only for open source repository
   - Clear problem descriptions in English
   - Solution explanations in English
   - Code review comments in English

### Code Quality Standards
- **TypeScript**: Strict mode enabled, full type safety
- **ESLint + Prettier**: Consistent code formatting
- **Testing**: Minimum 80% test coverage required
- **Documentation**: All public APIs must be documented

### Git Workflow Standards
- **Branch Naming**: Use English descriptive names (e.g., `feature/user-authentication`, `fix/payment-bug`)
- **Pull Requests**: Must include English description and testing instructions
- **Code Review**: All reviews conducted in English

## Technical Architecture

### Technology Stack
**Backend**:
- Framework: Fastify 4.29 + TypeScript 5.3
- Database: SQLite (dev) / PostgreSQL (prod)
- ORM: Prisma ORM
- Authentication: JWT + bcrypt
- Caching: Redis
- File Processing: Multer + image processing
- Email Service: Nodemailer
- Validation: Zod
- API Documentation: OpenAPI/Swagger

**Frontend**:
- Framework: Next.js 15 + App Router
- Language: TypeScript 5.3
- Styling: Tailwind CSS + custom design system
- UI Components: Radix UI
- State Management: Zustand + React Query
- Forms: React Hook Form + Zod
- Animations: Framer Motion
- Icons: Lucide React

**Development Tools**:
- Package Manager: pnpm + workspace
- Build Tool: Turbo monorepo
- Code Quality: ESLint + Prettier
- Type Checking: TypeScript strict mode

### Architecture Type
**Architecture**: Microservices + Frontend-Backend Separation
- Monorepo management for multiple applications
- Complete frontend-backend separation via RESTful API
- Plugin architecture for feature extension
- Multi-tenant architecture for SaaS services

## Feature Requirements

### Core E-commerce Features
- [x] User authentication and authorization (JWT-based with role management)
- [x] Product CRUD operations with image upload support
- [x] Shopping cart and order management
- [x] Advanced search and filtering
- [x] Real-time inventory tracking
- [x] Payment gateway integration

### Advanced Features
- [x] Redis caching for high performance
- [x] Comprehensive audit logging
- [x] Fine-grained permission control
- [x] Email notification system
- [x] File upload system with validation
- [x] Plugin architecture framework
- [x] Multilingual support (6 languages with real-time switching)

### Commercial Features
- [x] Plugin system architecture
- [ ] Plugin marketplace (Q1 2025)
- [x] License management system
- [x] Multi-tenant SaaS architecture
- [ ] Template marketplace (Q1 2025)
- [x] Revenue sharing system

## API Standards

### RESTful API Design
- Use standard HTTP methods (GET, POST, PUT, DELETE)
- Consistent URL patterns: `/api/resource` or `/api/resource/:id`
- Proper HTTP status codes
- JSON request/response format
- Comprehensive error handling

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Resource-level permissions
- Secure password hashing with bcrypt

### API Documentation
- Swagger/OpenAPI documentation required
- All endpoints must be documented
- Request/response examples provided
- Error response documentation

## Testing Requirements

### Test Coverage
- Minimum 80% code coverage
- Unit tests for all business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows

### Test Types
- **Unit Tests**: Individual function/component testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Complete user workflow testing
- **Performance Tests**: Load and stress testing

## Deployment Requirements

### Environment Configuration
- Development: Local with SQLite
- Staging: Docker containers with PostgreSQL
- Production: Scalable cloud deployment

### CI/CD Pipeline
- Automated testing on pull requests
- Automated deployment to staging
- Manual approval for production deployment
- Rollback capabilities

## Security Requirements

### Data Protection
- HTTPS encryption for all communications
- Secure password storage with bcrypt
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Authentication Security
- JWT token expiration
- Secure session management
- Rate limiting for API endpoints
- CORS configuration

## Performance Requirements

### Response Time
- API responses: < 200ms for 95% of requests
- Page load time: < 2 seconds
- Database queries: Optimized with proper indexing
- Caching strategy: Redis for frequently accessed data

### Scalability
- Horizontal scaling support
- Database connection pooling
- CDN integration for static assets
- Load balancing capabilities

## Monitoring and Logging

### Application Monitoring
- Health check endpoints
- Performance metrics collection
- Error tracking and alerting
- User activity monitoring

### Logging Standards
- Structured logging format
- Log levels: ERROR, WARN, INFO, DEBUG
- Audit trail for sensitive operations
- Log retention policies

---

*Document Version: v1.0*  
*Last Updated: December 2024*  
*Maintained by: Development Team*

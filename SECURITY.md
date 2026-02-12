# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.1 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Seentics seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to [security@seentics.com](mailto:security@seentics.com).

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths of source file(s) related to the vulnerability**
- **The location of the affected source code (tag/branch/commit or direct URL)**
- **Any special configuration required to reproduce the issue**
- **Step-by-step instructions to reproduce the issue**
- **Proof-of-concept or exploit code (if possible)**
- **Impact of the issue, including how an attacker might exploit it**

This information will help us triage your report more quickly.

## Preferred Languages

We prefer to receive vulnerability reports in English, but we can also handle reports in other languages if necessary.

## Disclosure Policy

When we receive a security bug report, we will:

1. **Confirm the problem** and determine affected versions
2. **Audit code** to find any similar problems
3. **Prepare fixes** for all supported versions
4. **Release a new version** with the fix
5. **Disclose the vulnerability** in the release notes

## Security Best Practices

### For Users

1. **Keep dependencies updated** - Regularly update all packages and dependencies
2. **Use strong secrets** - Generate strong, unique JWT secrets and API keys
3. **Enable HTTPS** - Always use HTTPS in production environments
4. **Monitor logs** - Regularly check application and security logs
5. **Regular backups** - Maintain regular backups of your data
6. **Access control** - Implement proper role-based access control

### For Developers

1. **Input validation** - Always validate and sanitize user input
2. **Authentication** - Implement proper authentication and authorization
3. **Data encryption** - Encrypt sensitive data at rest and in transit
4. **Rate limiting** - Implement rate limiting to prevent abuse
5. **Logging** - Log security-relevant events for monitoring
6. **Dependency scanning** - Regularly scan for vulnerable dependencies

## Security Features

Seentics includes several security features by default:

- **JWT-based authentication** with configurable expiration
- **OAuth 2.0 integration** for secure third-party authentication
- **Rate limiting** to prevent abuse and DDoS attacks
- **CORS protection** to control cross-origin requests
- **Input validation** and sanitization
- **SQL injection protection** through parameterized queries
- **XSS protection** through proper output encoding
- **CSRF protection** for state-changing operations

## Security Updates

Security updates are released as patch versions (e.g., 0.1.1, 0.1.2) and should be applied as soon as possible.

To receive security update notifications:

1. **Watch the repository** on GitHub
2. **Subscribe to releases** for update notifications
3. **Monitor the changelog** for security-related changes

## Responsible Disclosure

We ask that you:

- **Give us reasonable time** to respond to issues before you disclose them publicly
- **Provide sufficient information** to reproduce the problem
- **Make a good faith effort** to avoid privacy violations, destruction of data, and interruption or degradation of our service

## Security Team

Our security team consists of:

- **Security Lead**: [Seentics Team] - [security@seentics.com](mailto:security@seentics.com)
- **Core Maintainers**: Project maintainers with security expertise
- **Community Security Reviewers**: Trusted community members

## Acknowledgments

We would like to thank all security researchers and community members who responsibly disclose vulnerabilities to us. Your contributions help make Seentics more secure for everyone.

## License

This security policy is licensed under the same terms as the Seentics project (AGPL v3 License).

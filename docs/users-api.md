# Users API

## GET /api/users

List all users with their role information.

### Authentication

Requires a Bearer token with a valid studio session JWT.

### Permissions

Requires `users.read` permission.

### Response

```json
{
  "data": [
    {
      "id": "1ced463a-ed0c-40dd-aa26-ab4b9033d9ab",
      "email": "flaxo.dev@gmail.com",
      "name": "Flaxo",
      "roleId": 2,
      "isActive": true,
      "createdAt": "2026-05-21T09:28:55.261Z",
      "role": {
        "id": 2,
        "name": "admin",
        "description": "Full administrative access except destructive actions"
      }
    }
  ]
}
```

### Example

```bash
curl -H "Authorization: Bearer <studio-token>" http://localhost:3000/api/users
```

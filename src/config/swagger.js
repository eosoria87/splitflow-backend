const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SplitFlow API',
      version: '1.0.0',
      description: 'API para gestión de gastos compartidos en grupos',
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'http://localhost:3001',
        description: process.env.NODE_ENV === 'production' ? 'Producción' : 'Desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        SignupRequest: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email', example: 'usuario@example.com' },
            password: { type: 'string', minLength: 6, example: 'password123' },
            name: { type: 'string', example: 'Juan Pérez' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'usuario@example.com' },
            password: { type: 'string', example: 'password123' },
          },
        },
        Group: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Viaje a la playa' },
            description: { type: 'string', example: 'Gastos del viaje de verano' },
            category: { type: 'string', example: 'viaje' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            description: { type: 'string', example: 'Cena en restaurante' },
            amount: { type: 'number', example: 120.50 },
            category: { type: 'string', example: 'comida' },
            date: { type: 'string', format: 'date', example: '2026-03-24' },
            paid_by: { type: 'string', format: 'uuid' },
          },
        },
        Settlement: {
          type: 'object',
          properties: {
            from_user: { type: 'string', format: 'uuid' },
            to_user: { type: 'string', format: 'uuid' },
            amount: { type: 'number', example: 45.00 },
            method: { type: 'string', example: 'transferencia' },
            notes: { type: 'string', example: 'Pago por Bizum' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Autenticación y sesión de usuario' },
      { name: 'Groups', description: 'Gestión de grupos' },
      { name: 'Members', description: 'Gestión de miembros de un grupo' },
      { name: 'Expenses', description: 'Gestión de gastos dentro de un grupo' },
      { name: 'Balances', description: 'Balances y liquidaciones del grupo' },
    ],
    paths: {
      // ── AUTH ──────────────────────────────────────────────────────────────
      '/api/auth/signup': {
        post: {
          tags: ['Auth'],
          summary: 'Registro de nuevo usuario',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } },
          },
          responses: {
            201: { description: 'Usuario creado exitosamente' },
            400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Iniciar sesión',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            200: { description: 'Login exitoso, devuelve access_token y refresh_token' },
            401: { description: 'Credenciales inválidas' },
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Renovar access token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { refresh_token: { type: 'string' } } } } },
          },
          responses: {
            200: { description: 'Token renovado' },
            401: { description: 'Refresh token inválido o expirado' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Obtener usuario autenticado',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Datos del usuario actual' },
            401: { description: 'No autenticado' },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Cerrar sesión',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Sesión cerrada' },
          },
        },
      },

      // ── GROUPS ────────────────────────────────────────────────────────────
      '/api/groups': {
        post: {
          tags: ['Groups'],
          summary: 'Crear un grupo',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Viaje a la playa' },
                    description: { type: 'string', example: 'Gastos del viaje' },
                    category: { type: 'string', example: 'viaje' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Grupo creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Group' } } } },
            401: { description: 'No autenticado' },
          },
        },
        get: {
          tags: ['Groups'],
          summary: 'Obtener grupos del usuario',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Lista de grupos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Group' } } } } },
          },
        },
      },
      '/api/groups/{groupId}': {
        get: {
          tags: ['Groups'],
          summary: 'Obtener un grupo por ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Datos del grupo' },
            404: { description: 'Grupo no encontrado' },
          },
        },
        put: {
          tags: ['Groups'],
          summary: 'Actualizar grupo (solo owner)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Grupo actualizado' },
            403: { description: 'Sin permisos' },
          },
        },
        delete: {
          tags: ['Groups'],
          summary: 'Eliminar grupo (solo owner)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Grupo eliminado' },
            403: { description: 'Sin permisos' },
          },
        },
      },

      // ── MEMBERS ───────────────────────────────────────────────────────────
      '/api/groups/{groupId}/members': {
        post: {
          tags: ['Members'],
          summary: 'Añadir miembro al grupo (solo owner)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Miembro añadido' },
            403: { description: 'Sin permisos' },
          },
        },
      },
      '/api/groups/{groupId}/members/{userId}': {
        delete: {
          tags: ['Members'],
          summary: 'Eliminar miembro del grupo (solo owner)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } },
            { in: 'path', name: 'userId', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Miembro eliminado' },
            403: { description: 'Sin permisos' },
          },
        },
      },

      // ── EXPENSES ──────────────────────────────────────────────────────────
      '/api/groups/{groupId}/expenses': {
        post: {
          tags: ['Expenses'],
          summary: 'Añadir gasto al grupo',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['description', 'amount'],
                  properties: {
                    description: { type: 'string', example: 'Cena' },
                    amount: { type: 'number', example: 80.00 },
                    category: { type: 'string', example: 'comida' },
                    date: { type: 'string', format: 'date', example: '2026-03-24' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Gasto añadido', content: { 'application/json': { schema: { $ref: '#/components/schemas/Expense' } } } },
          },
        },
        get: {
          tags: ['Expenses'],
          summary: 'Obtener gastos del grupo',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Lista de gastos' },
          },
        },
      },
      '/api/groups/{groupId}/expenses/{expenseId}': {
        get: {
          tags: ['Expenses'],
          summary: 'Obtener detalle de un gasto',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } },
            { in: 'path', name: 'expenseId', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Detalle del gasto' }, 404: { description: 'No encontrado' } },
        },
        put: {
          tags: ['Expenses'],
          summary: 'Actualizar gasto (solo quien pagó)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } },
            { in: 'path', name: 'expenseId', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    amount: { type: 'number' },
                    category: { type: 'string' },
                    date: { type: 'string', format: 'date' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Gasto actualizado' }, 403: { description: 'Sin permisos' } },
        },
        delete: {
          tags: ['Expenses'],
          summary: 'Eliminar gasto (solo quien pagó)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } },
            { in: 'path', name: 'expenseId', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Gasto eliminado' }, 403: { description: 'Sin permisos' } },
        },
      },

      // ── BALANCES & SETTLEMENTS ────────────────────────────────────────────
      '/api/groups/{groupId}/balances': {
        get: {
          tags: ['Balances'],
          summary: 'Obtener balances del grupo',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Balances de todos los miembros' } },
        },
      },
      '/api/groups/{groupId}/settlements': {
        get: {
          tags: ['Balances'],
          summary: 'Historial de liquidaciones',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Lista de liquidaciones' } },
        },
        post: {
          tags: ['Balances'],
          summary: 'Registrar una liquidación',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Settlement' } } },
          },
          responses: { 201: { description: 'Liquidación registrada' } },
        },
      },
      '/api/groups/{groupId}/settlements/suggestions': {
        get: {
          tags: ['Balances'],
          summary: 'Sugerencias de liquidación optimizadas',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'groupId', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Lista de liquidaciones sugeridas para minimizar transacciones' } },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);

import createDB from '../../../src/db/create-db.mjs'
import { test } from 'node:test'
import { deepEqual, equal, ok } from 'node:assert'
import { isFileAccessible } from '../../../src/utils.mjs'
import { tmpdir } from 'os'
import { join } from 'path'
import dotenv from 'dotenv'
import { schema } from '@platformatic/db'
import Ajv from 'ajv'
import { mkdtemp, readFile, rm } from 'fs/promises'

const moviesMigrationDo = `
-- Add SQL in this file to create the database tables for your API
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
`

const moviesMigrationUndo = `
-- Add SQL in this file to drop the database tables 
DROP TABLE movies;
`

const base = tmpdir()
let tmpDir
let log = []
test.beforeEach(async () => {
  tmpDir = await mkdtemp(join(base, 'test-create-platformatic-'))
})

test.afterEach(async () => {
  log = []
  await rm(tmpDir, { recursive: true, force: true })
  process.env = {}
})

const fakeLogger = {
  debug: msg => log.push(msg),
  info: msg => log.push(msg)
}

test('creates project with no typescript', async () => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: true
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const pathToMigrationFolder = join(tmpDir, 'migrations')
  const pathToMigrationFileDo = join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = join(pathToMigrationFolder, '001.undo.sql')

  const dbConfigFile = await readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { server, db, migrations } = dbConfig
  const ajv = new Ajv({ strict: false })
  ajv.addKeyword('relativePath')
  const validate = ajv.compile(schema)
  equal(validate(dbConfig), true)

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')
  equal(db.connectionString, '{DATABASE_URL}')
  equal(db.schemalock, true)

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')

  equal(db.graphql, true)
  equal(db.openapi, true)
  equal(migrations.dir, 'migrations')

  const migrationFileDo = await readFile(pathToMigrationFileDo, 'utf8')
  equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await readFile(pathToMigrationFileUndo, 'utf8')
  equal(migrationFileUndo, moviesMigrationUndo)

  equal(await isFileAccessible(join(tmpDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(tmpDir, 'plugins', 'example.js')), true)
})

test('creates project with no typescript and no plugin', async () => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: false,
    connectionString: 'sqlite://./custom/path/to/db.sqlite'
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const pathToMigrationFolder = join(tmpDir, 'migrations')
  const pathToMigrationFileDo = join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = join(pathToMigrationFolder, '001.undo.sql')

  const dbConfigFile = await readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { server, db, migrations } = dbConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')
  equal(db.connectionString, '{DATABASE_URL}')

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./custom/path/to/db.sqlite')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')

  equal(db.graphql, true)
  equal(db.openapi, true)
  equal(migrations.dir, 'migrations')

  const migrationFileDo = await readFile(pathToMigrationFileDo, 'utf8')
  equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await readFile(pathToMigrationFileUndo, 'utf8')
  equal(migrationFileUndo, moviesMigrationUndo)

  equal(await isFileAccessible(join(tmpDir, 'plugin.js')), false)
})

test('creates project with no migrations', async () => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    migrations: ''
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const dbConfigFile = await readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { migrations } = dbConfig

  equal(migrations, undefined)
})

test('creates project with typescript', async () => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: true
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const pathToMigrationFolder = join(tmpDir, 'migrations')
  const pathToMigrationFileDo = join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = join(pathToMigrationFolder, '001.undo.sql')

  const dbConfigFile = await readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { server, db, migrations, plugins } = dbConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')
  equal(db.connectionString, '{DATABASE_URL}')

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')
  equal(process.env.PLT_TYPESCRIPT, 'true')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')
  equal(process.env.PLT_TYPESCRIPT, 'true')

  equal(db.graphql, true)
  equal(db.openapi, true)
  equal(migrations.dir, 'migrations')

  const migrationFileDo = await readFile(pathToMigrationFileDo, 'utf8')
  equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await readFile(pathToMigrationFileUndo, 'utf8')
  equal(migrationFileUndo, moviesMigrationUndo)

  deepEqual(plugins.paths, [{
    path: './plugins',
    encapsulate: false
  }, {
    path: './routes'
  }])
  equal(plugins.typescript, '{PLT_TYPESCRIPT}')
  equal(await isFileAccessible(join(tmpDir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(tmpDir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(tmpDir, 'tsconfig.json')), true)
})

test('creates project with no default migrations', async () => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: false,
    migrations: ''
  }
  await createDB(params, fakeLogger, tmpDir)
  ok(!log.includes('Migrations folder migrations successfully created.'))
  ok(!log.includes('Migration file 001.do.sql successfully created.'))
  ok(!log.includes('Migration file 001.undo.sql successfully created.'))
})

test('creates project with default migrations', async () => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: false,
    migrations: 'migrations'
  }
  await createDB(params, fakeLogger, tmpDir)
  ok(log.includes('Migrations folder migrations successfully created.'))
  ok(log.includes('Migration file 001.do.sql successfully created.'))
  ok(log.includes('Migration file 001.undo.sql successfully created.'))
})

test('creates project in a runtime context', async () => {
  const params = {
    isRuntimeContext: true,
    hostname: 'myhost',
    port: 6666,
    plugin: true
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const pathToMigrationFolder = join(tmpDir, 'migrations')
  const pathToMigrationFileDo = join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = join(pathToMigrationFolder, '001.undo.sql')

  const dbConfigFile = await readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { server, db, migrations } = dbConfig
  const ajv = new Ajv({ strict: false })
  ajv.addKeyword('relativePath')
  const validate = ajv.compile(schema)
  equal(validate(dbConfig), true)

  equal(server, undefined)
  equal(db.connectionString, '{DATABASE_URL}')
  equal(db.schemalock, true)

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, undefined)
  equal(process.env.PORT, undefined)
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, undefined)
  equal(process.env.PORT, undefined)
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')

  equal(db.graphql, true)
  equal(db.openapi, true)
  equal(migrations.dir, 'migrations')

  const migrationFileDo = await readFile(pathToMigrationFileDo, 'utf8')
  equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await readFile(pathToMigrationFileUndo, 'utf8')
  equal(migrationFileUndo, moviesMigrationUndo)

  equal(await isFileAccessible(join(tmpDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(tmpDir, 'plugins', 'example.js')), true)
})
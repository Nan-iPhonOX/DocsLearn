# pgslq

```bash {cmd=true}
\> initdb
initdb: error: no data directory specified
initdb: hint: You must identify the directory where the data for this database system will reside.  Do this with either the invocation option -D or the environment variable PGDATA.
```

```bash
\>initdb -D ~/pgdata
Success. You can now start the database server using:
    pg_ctl -D /home/crazy/pgdata -l logfile start
```

## FATAL: database "\<user\>" does not exist

## 错误原因
出现这个错误的原因是因为在连接到指定的数据库时，该数据库不存在。当psql命令尝试连接到一个不存在的数据库时，系统会抛出这个错误。


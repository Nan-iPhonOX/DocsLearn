
-- 创建新的数据库
CREATE DATABASE learn;

CREATE DATABASE learn1 with OWNER = crazy ENCODING = 'utf-8';

-- 修改数据库
ALTER DATABASE learn RENAME TO learn2;
-- 删除数据库
DROP DATABASE learn;

-- 创建数据表

CREATE Table student(
    id SERIAL,
    name VARCHAR(20),
    age INT
)

-- 添加约束
alter table student alter name set not null;

-- 修改数据类型
ALTER TABLE student 
    ALTER COLUMN id TYPE SERIAL;
    
--移除主键
alter table student drop constraint id;

-- 删除数据表
DROP Table student;

-- 插入数据
INSERT INTO student(name,age) VALUES ('vgsj',18);

-- 删除数据
DELETE FROM student WHERE age = 18;

-- 修改数据
UPDATE student SET age = 18 WHERE age = 19;
 
SELECT * FROM student;
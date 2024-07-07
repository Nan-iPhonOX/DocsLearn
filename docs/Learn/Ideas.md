# IDEAs 奇思

## svg

### 做svg动画

1.给学习资料做插入动画

参考

## C++

### 尝试写一个base64 <=> Bin 的转换函数.

### 实现一个刷脸提示工具

#### 获取验证图片base64
```YAML
GET /api/getVerifyCode HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Accept: application/json, text/plain, */*
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Referer: http://10.96.5.31:8081/user/login
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:45:55 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: 7ac15d69-2756-495c-8396-2359755f70e6
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"............","data":{"captchaId":"78521255-a02c-4f28-bd86-d6c7b6649e19","imageUrl":"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"}}
```

#### 

```YAML
POST /api/login HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Content-Length: 247
Accept: application/json, text/plain, */*
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Content-Type: application/json;charset=UTF-8
Origin: http://10.96.5.31:8081
Referer: http://10.96.5.31:8081/user/login
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

{"password":"25a2448d9183abbf562e24b5661aab73","captchaCode":"0waw","account":"3e7a18411a1dc0892e9f2fefbc8f0e7b46ee3adf52ce8cbce88313f1b1f2854b","requestId":"1721715f-87c4-4566-bc36-80cd3a865232","captchaId":"78521255-a02c-4f28-bd86-d6c7b6649e19"}HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:46:26 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: f18ad86b-d0f8-4764-a136-083d1d96142f
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"............","data":"eyJhbGciOiJIUzUxMiJ9.eyJ1c2VySWQiOjE0NjU2Nzk0MDI0MDY4NTQ2NjAsImFjY291bnQiOiJ6emd0amNzc2RfenpuendndHpod3hjaiIsInV1aWQiOiI5NTI5OTJkYS05YmIyLTQ2NDMtOTllNS1mYzUxNTljYTBkMjQiLCJzdWIiOiIxNDY1Njc5NDAyNDA2ODU0NjYwIiwiaWF0IjoxNzE3NDc2Mzg2LCJleHAiOjE3MTc1NjI3ODZ9.sJ-Qaj2r4QvXkBMeh2hIBBivs5sBYt_cf_G8Rob3VutPDjBlDD241XDij4zGssI6DpjRDR3pj7Q6wFwg3ybHrg"}
```

#### 刷脸记录

```YAML
GET /api/personClockRecord/page?pageNo=1&pageSize=10&personName=%E5%8D%97%E6%95%8F%E6%9D%B0 HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Accept: application/json, text/plain, */*
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJ1c2VySWQiOjE0NjU2Nzk0MDI0MDY4NTQ2NjAsImFjY291bnQiOiJ6emd0amNzc2RfenpuendndHpod3hjaiIsInV1aWQiOiI5NTI5OTJkYS05YmIyLTQ2NDMtOTllNS1mYzUxNTljYTBkMjQiLCJzdWIiOiIxNDY1Njc5NDAyNDA2ODU0NjYwIiwiaWF0IjoxNzE3NDc2Mzg2LCJleHAiOjE3MTc1NjI3ODZ9.sJ-Qaj2r4QvXkBMeh2hIBBivs5sBYt_cf_G8Rob3VutPDjBlDD241XDij4zGssI6DpjRDR3pj7Q6wFwg3ybHrg
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Referer: http://10.96.5.31:8081/personClockRecord
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:49:51 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: ca2e94ff-c0af-464a-815b-16995bd2f865
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"请求成功","data":{"pageNo":1,"pageSize":10,"totalPage":3,"totalRows":23,"rows":[{"createTime":"2024-06-04 11:38:31.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1797835416099311626","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/06/04 11:37:03","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-06-03 18:35:22.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1797577844029083662","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA08C1801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/06/03 18:33:49","signInPlace":"郑州南高铁综合维修工区","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-06-03 12:05:11.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1797479697181265931","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA08C1801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/06/03 12:03:43","signInPlace":"郑州南高铁综合维修工区","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-05-31 12:37:51.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1796400712531783691","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/05/31 12:36:28","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-05-31 12:36:01.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1796400334994092039","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/05/31 12:34:37","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-05-31 12:10:57.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1796393918048710674","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/05/31 07:58:39","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-05-31 08:00:11.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1796330878607503369","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/05/31 07:58:38","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-05-31 12:10:57.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1796394043840081955","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/05/30 17:53:00","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-05-30 17:54:23.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1796117974557863964","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/05/30 17:52:59","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0},{"createTime":"2024-05-31 16:13:51.000","createUser":"-1","updateTime":null,"updateUser":null,"id":"1796455071223328794","deptId":"1438041201115070465","deptName":"郑州南郑万高铁综合维修车间","deviceIdentifier":"84E0F42AA0921801","deviceType":"attendance_device_type_01","orgId":"1437963229284790273","orgName":"郑州高铁基础设施段","personIdentifier":"173781","personName":"南敏杰(2130)","reference":null,"signInTime":"2024/05/30 08:08:19","signInPlace":"郑州南高铁综合维修车间","teamId":"1438397165625999362","teamName":"郑州南线路所高铁综合维修工区","workId":null,"inOutSign":null,"upDownSign":null,"groupId":null,"clockInSign":null,"isDeleted":0}],"rainbow":[1,2,3],"beginDateString":null,"year":null,"orgName":null,"endDateString":null,"yearMonth":null}}
```

#### 获取排班

```YAML
GET /api/workPlanShift/page?pageNo=1&pageSize=10&deptId=1438397165625999362&isCenter=0&yearMonth=2024-06&deptRank=1&deptSign=1&selectNoShift=0&personName=%E5%8D%97%E6%95%8F%E6%9D%B0 HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Accept: application/json, text/plain, */*
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJ1c2VySWQiOjE0NjU2Nzk0MDI0MDY4NTQ2NjAsImFjY291bnQiOiJ6emd0amNzc2RfenpuendndHpod3hjaiIsInV1aWQiOiI5NTI5OTJkYS05YmIyLTQ2NDMtOTllNS1mYzUxNTljYTBkMjQiLCJzdWIiOiIxNDY1Njc5NDAyNDA2ODU0NjYwIiwiaWF0IjoxNzE3NDc2Mzg2LCJleHAiOjE3MTc1NjI3ODZ9.sJ-Qaj2r4QvXkBMeh2hIBBivs5sBYt_cf_G8Rob3VutPDjBlDD241XDij4zGssI6DpjRDR3pj7Q6wFwg3ybHrg
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Referer: http://10.96.5.31:8081/workPlanRule
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:52:47 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: 1ebdec3a-ceb9-4daa-aa2c-9436514586f4
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"请求成功","data":{"pageNo":1,"pageSize":10,"totalPage":1,"totalRows":1,"rows":[{"2024-06-30":{"dataIndex":"2024-06-30","match":"第七天","title":"休"},"2024-06-12":{"dataIndex":"2024-06-12","match":"第三天","title":"第三天"},"2024-06-11":{"dataIndex":"2024-06-11","match":"第二天","title":"第二天"},"2024-06-10":{"dataIndex":"2024-06-10","match":"第一天","title":"第一天"},"schemeId":"1691012468470943746","schemeIdentifier":"2022041100049","2024-06-16":{"dataIndex":"2024-06-16","match":"第七天","title":"休"},"2024-06-15":{"dataIndex":"2024-06-15","match":"第六天","title":"休"},"2024-06-14":{"dataIndex":"2024-06-14","match":"第五天","title":"第五天"},"2024-06-13":{"dataIndex":"2024-06-13","match":"第四天","title":"第四天"},"2024-06-09":{"dataIndex":"2024-06-09","match":"第七天","title":"休"},"2024-06-08":{"dataIndex":"2024-06-08","match":"第六天","title":"休"},"2024-06-07":{"dataIndex":"2024-06-07","match":"第五天","title":"第五天"},"2024-06-29":{"dataIndex":"2024-06-29","match":"第六天","title":"休"},"2024-06-06":{"dataIndex":"2024-06-06","match":"第四天","title":"第四天"},"2024-06-28":{"dataIndex":"2024-06-28","match":"第五天","title":"第五天"},"yearMonth":"2024-06","2024-06-01":{"dataIndex":"2024-06-01","match":"第六天","title":"休"},"2024-06-23":{"dataIndex":"2024-06-23","match":"第七天","title":"休"},"schemeName":"日勤制（夜）刷脸方案","clockOnNeeded":1,"2024-06-22":{"dataIndex":"2024-06-22","match":"第六天","title":"休"},"2024-06-21":{"dataIndex":"2024-06-21","match":"第五天","title":"第五天"},"2024-06-20":{"dataIndex":"2024-06-20","match":"第四天","title":"第四天"},"2024-06-05":{"dataIndex":"2024-06-05","match":"第三天","title":"第三天"},"2024-06-27":{"dataIndex":"2024-06-27","match":"第四天","title":"第四天"},"2024-06-04":{"dataIndex":"2024-06-04","match":"第一天","title":"第一天"},"2024-06-26":{"dataIndex":"2024-06-26","match":"第三天","title":"第三天"},"2024-06-03":{"dataIndex":"2024-06-03","match":"第一天","title":"第一天"},"2024-06-25":{"dataIndex":"2024-06-25","match":"第二天","title":"第二天"},"2024-06-02":{"dataIndex":"2024-06-02","match":"第七天","title":"休"},"2024-06-24":{"dataIndex":"2024-06-24","match":"第一天","title":"第一天"},"personName":"南敏杰（2130）","2024-06-19":{"dataIndex":"2024-06-19","match":"第三天","title":"第三天"},"2024-06-18":{"dataIndex":"2024-06-18","match":"第二天","title":"第二天"},"2024-06-17":{"dataIndex":"2024-06-17","match":"第一天","title":"第一天"},"personIdentifier":"173781"}],"rainbow":[1],"beginDateString":null,"year":null,"orgName":null,"endDateString":null,"yearMonth":null}}
```
#### 第二遍
```YAML
GET /api/getVerifyCode HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Accept: application/json, text/plain, */*
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Referer: http://10.96.5.31:8081/user/login?redirect=%2FworkPlanRule
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:55:20 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: 891530a3-564b-4926-a9ea-d32a596b0f40
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"请求成功","data":{"captchaId":"1a7b11a6-1095-46f0-959f-272f4911e824","imageUrl":"iVBORw0KGgoAAAANSUhEUgAAAGQAAAAeCAIAAABVOSykAAAEuklEQVR42u2Z31MbVRTH+Sd8d+xMxxmnzvjW8cUHHX+8FUGwrWO1M2h/UdpqQSrBViqmTEi1DFqmNCljDcHYMQUSCuk0SBNBIOVHoVAQSNL8okAgm5DfWT1OZDlswu7djYLM5M55Yc9yuPfDved+z9mcP7ODeORkEWRhZWFlYe1UWDRNWx4ONt268fX31R+WflBw4p3843mFxQVF54pqG2Wmgfs7eqnK4qmLl63XfOGKpeB784E3XP5XXdRrLirf47/gDY5E4sJg1TVdyT2yj8NKpWf9q36Smc112BufVTHWebj7YPQ7lm0xLGD0ipPiMNlySACsY5VHuWGBNaiuksysXzqMYfVVWVLf2WJ8uW4/NyywnwMRIljLvmWJvELb9cvIxHAsFkueysezj8/JyjGsg6cPkMzMUNSDYc3qbIxLV3hk689ggKaBBRw9+UqoNxSL0n8/tMcSpxdXMaxD84GMErzP78OwIIuRTK7pBQ2GtTJLbS+sB+G4ggoHaZr1fDFOY1iQwjKCFU/EMayTF05yvPzHbStmlNai/ij5IqORYKuqnLF2dQW9tuClp1bs6tJKxXHEsN5y+TOC1dGtx7DgnHK8bCrv5ybVvFcraCXuJ+OYiMnQsH6HTPVi16BJJYLUo0gcwypbCoqBBf9Aq2NOoVFgUiApuP92W14XNyxjiVnQYiZHDZjI6MA6a4tZjV0zkybW7/7+5mGWpcYvXdxwRfaHYwJgafSatJfgma/OGEwGwhXeed+IAc202UTnmv6em5iI0zbKuO6112LXU/c0bzQWu+o6NSZ1SZB0gFHTcCmVFKhT+XW5zUm6ZuXzLRjW0sSyaFh6zXlMJEAt/JNJ41H8vK35c5pOCIoM6hSTknAewPSwQBlsprAA2djUGG/EVXcQk1LuVosmFQr6MBFdSyXj8jgmsOvXjjrysL4EXbZRoH67Es6oNgyFQ2aLufj8Cczr0+pPeCNaO59gWG35BtGwXPYxTKTPqGRcU2P3sGuoT0Oe0Qs8AawV9KuktzPPbbjgXWBtLt6IFvkohtVT2ica1vgDHSYyPqRnXAAOuxzWYZKAtwNRqAcZUkBtOirg8OYIElkHTu3njXj36P0Nhc5z9dZdMjDDod2MEU6u16jARGCjrR1PCpIUdlErHu5QIEervCGWSqAS9L/ZomFdjt8oLvNGVL+sxbAWx71piiEEjoOd7qcvMJF55+TaFfnDZrks7YCyBuoYTKqJiohp0UBiqqr7UmfUQfJOloR7KltflGj3ltW/XnIKk8o79rbdZeeNeH1XM4YFml70MWRtn+nx7lgsYjE344esXJY6JqJxKAkZTPvcfih9RPazeNsyDCnCftbNl26llaO/VQ4InRxLSW1mj4bvcOkYKsLbbAAr9AT4YZG0ZcprPgM1T1qyXnmYFhZuPBAO+8xgKpofJR+11BzHT6Ak4ggi4WtjJe2iN8QPy+F2wBmsbZSBRt9f8i7sILBkd1R6VapuV5NjWt/5qunW3C5QWBgWZfOL2PlO20hPZz3Uz+1qifnuNcfcENRh8COGFQkHMmxjgXUQCIj/aQ9eueeZpGU/WAgeH984m4UljNe2I9thn8K2F1n2u2EW1n8z/gK6pak8k4gT8AAAAABJRU5ErkJggg=="}}POST /api/login HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Content-Length: 247
Accept: application/json, text/plain, */*
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Content-Type: application/json;charset=UTF-8
Origin: http://10.96.5.31:8081
Referer: http://10.96.5.31:8081/user/login?redirect=%2FworkPlanRule
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

{"password":"5401368e63d6669d46011e96c3d2821f","captchaCode":"3tu2","account":"357efd199b26dc030b19b328715af12c73d9e07304fc264580dc62712cc499a1","requestId":"5dc86ee3-b3b6-40f4-8124-1d13743c7003","captchaId":"1a7b11a6-1095-46f0-959f-272f4911e824"}HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:55:29 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: 4e9fdebc-a023-46dd-8135-19c77e1d2a50
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"请求成功","data":"eyJhbGciOiJIUzUxMiJ9.eyJ1c2VySWQiOjE0NjU2Nzk0MDI0MDY4NTQ2NjAsImFjY291bnQiOiJ6emd0amNzc2RfenpuendndHpod3hjaiIsInV1aWQiOiIzZjQ5MWE2OS05ODRkLTQwYTEtOTRlNC0zOTc5MWU1OTViMTkiLCJzdWIiOiIxNDY1Njc5NDAyNDA2ODU0NjYwIiwiaWF0IjoxNzE3NDc2OTI5LCJleHAiOjE3MTc1NjMzMjl9.wiL8oxEQuUCxyYH5i38Pq_xMlZEn8RJsDfECfTjAj4LHy1bHCU019Hf2ExxOm7SdegVgPHGAqHoiTfMBJr1LSQ"}GET /api/judgePasswordExpire HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Accept: application/json, text/plain, */*
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJ1c2VySWQiOjE0NjU2Nzk0MDI0MDY4NTQ2NjAsImFjY291bnQiOiJ6emd0amNzc2RfenpuendndHpod3hjaiIsInV1aWQiOiIzZjQ5MWE2OS05ODRkLTQwYTEtOTRlNC0zOTc5MWU1OTViMTkiLCJzdWIiOiIxNDY1Njc5NDAyNDA2ODU0NjYwIiwiaWF0IjoxNzE3NDc2OTI5LCJleHAiOjE3MTc1NjMzMjl9.wiL8oxEQuUCxyYH5i38Pq_xMlZEn8RJsDfECfTjAj4LHy1bHCU019Hf2ExxOm7SdegVgPHGAqHoiTfMBJr1LSQ
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Referer: http://10.96.5.31:8081/user/login?redirect=%2FworkPlanRule
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:55:29 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: 3b3d4c32-1e1c-4e7b-8540-b0efad36fadc
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"请求成功","data":"false"}GET /api/schemeOrg/getScheme?deptId= HTTP/1.1
Host: 10.96.5.31:8081
Connection: keep-alive
Accept: application/json, text/plain, */*
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJ1c2VySWQiOjE0NjU2Nzk0MDI0MDY4NTQ2NjAsImFjY291bnQiOiJ6emd0amNzc2RfenpuendndHpod3hjaiIsInV1aWQiOiIzZjQ5MWE2OS05ODRkLTQwYTEtOTRlNC0zOTc5MWU1OTViMTkiLCJzdWIiOiIxNDY1Njc5NDAyNDA2ODU0NjYwIiwiaWF0IjoxNzE3NDc2OTI5LCJleHAiOjE3MTc1NjMzMjl9.wiL8oxEQuUCxyYH5i38Pq_xMlZEn8RJsDfECfTjAj4LHy1bHCU019Hf2ExxOm7SdegVgPHGAqHoiTfMBJr1LSQ
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0
Referer: http://10.96.5.31:8081/workPlanRule
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6

HTTP/1.1 200 
Server: nginx
Date: Tue, 04 Jun 2024 04:55:29 GMT
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Request-No: c7ae8f28-99a0-4e0f-8537-060b94b4600f
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"success":true,"code":200,"message":"请求成功","data":[]}
```

### 做一个验证码识别库

#### tensorflow C++ 框架

### 在opencv上画位置

### 写一个vitepress自动目录函数

<<< @/.vitepress/AutoSideBar.ts

### 写一个修改单元格内字符颜色的command
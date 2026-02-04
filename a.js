// Bu script'i çalıştırın veya manuel düzeltin
const wrongJson = `{private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDZo/1W0UwyYAQU\nA2Tj8K2MG7S2wQYMLQMu51io0r30ET42okcq6dfdkuZLb6vdr738fsDccD703+vU\n8IzdYvgocAbozRCvafY3aVUTU+9RoRfD3DL85gBDi2BwNBVRE/M68W3kwtLxL1M8\nNKNqvhKdd8jefy9Sk5Menh1BgNeq+CrpymzjL2k/C3hy2uAalkVCf2YKfaGwDjxS\naaM7RvQW4hQFkMly4Vb9I6sbCQi7nWi6i1s+RetErHzv8WORxoZoKT57ZYI1eOzq\nC3DYLsGjzrIy74EXlt7hIQeS2LS+DFkQ1Cxh3lmEp4LSpGJ4I1CvE5OM0pUxBOzQ\nqo8UlbVDAgMBAAECggEAD3JzuzM8uMCW2YLKKOF+t9iJkYUOtFOHi88wvD7E66tD\noqYO7g1N3HSeMtF4vdHI5sBqWNsApOm1t9Xg8Z+iJGCbJO/VFNYs+w7XUnldHYqV\nALpCxi9e6mxcimov7yK+2zqihZ+MUED/I+FKjftyn8mOMLiPN8mwofYv9mO6KvCz\nvJ96pmqcxt95SLzH2zCFaK5RWLU3dWS5bV8LyieR29BxrWORRCe4LoDMhAKKi1R+\n4FBFp6lcyyh+XM4psJkFslkHyYrb6y6/0o/UVJiv4HJ9RUjH2kjC03vFilE9E560\nclQuSSeH1TWgUzzdvdLSCrg1oUo5EWaPn8vaUUqXxQKBgQDu/vb4zlA3Cl+qv+92\nCGlTnn2nfx/oBrDBYFOS8MyMaBVFuJaN9wANDWlYqCS6N2hYcayqFmaTEp0wUr/f\npfxVj+oD+lw3WtnqlLB4/kCqA1NGgn1qI6JFZrFtTVAvQjHNEVrVMOCCWUADTwtm\nWlAyhhwK2ocWwIamWF863/ExVQKBgQDpIA+6+UHBRc0Qax8dkpTRp1LyzLfIUpdA\nG11amyQipYKB+ZWeNM1Dwplv4EXT2Sc18JV+8GUqwx5u24UypWMXlyB7xdLA/Iql\nQBpjq8D94+GONZMvsCUUhnvDp185BOC8GPnl/cpo+WgE37CYrvqO+0z8U8BJw17S\nIbJEfCOsNwKBgQCOM2IbdBZCSYfWftEp96NDv5+gE4GWerScuoW/fksWl69gho39\n9iMvoPU3bQQ9UE5joW9M3Hs3svGYGQRVO9vBxRlGOKa5wPK8IrBFrXIoNkZMQ8P/\nbShWBt423LODCu26yEK1apmKtTPjRBrSUZY6GZWB17hdDzyOqTIwQ6Ks6QKBgQDQ\nq3gpHo+zFm21so0JhXlcKG/hEUm4L+Ve5p+rSI8RzCCDgwpfsFfDvV5me9NFC21D\npPPLyhZkLn8BL9GMQenu5cGXyL0bLXJU9IoqiUSYffAZwO7cksi+FJqXySs8+JbJ\nB3o4WfFiAU0Qf8GtCYMRlPOWMMk/vXcUlEDjeFLeBQKBgQCzmHgQG6fyDVnt4KmV\nW6z2tjfQ75VA/TQKkw3cQC1dSOcDRU6XrDOJm2tZHFICmZxfy0rrAgp8H55M7gsU\nD0ogFmHMU2pKRnWukOIGQLmz/vQ/zcdAKFWqQz8UYo3IdnbJYqN6F+i/ItDsVtGI\nVCasjf7JLk8rd1cAUIariHfFMA==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@lingo-master-8b33b.iam.gserviceaccount.com",
  "client_id": "110620098709684481238",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40lingo-master-8b33b.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"}`;

// \\\\n -> \n düzeltmesi
const fixedJson = wrongJson.replace(/\\\\\\\\n/g, '\\n');

console.log(fixedJson);
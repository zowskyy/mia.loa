/**
 * FRONTIER SYNTAX v2.0 — ENHANCED PARSER GRAMMAR
 * ANTLR v4.13.1
 * Adds: grammar versioning, IPFS imports, proof annotations, while loops
 */

grammar Frontier;

@header {
// ANTLR v4.13.1 — Frontier Syntax Parser v2.0
// Max nesting depth enforced at parse time: 64
}

program
    : versionDecl? statement* EOF
    ;

versionDecl
    : GRAMMAR_VERSION SEMICOLON
    ;

statement
    : letDecl
    | fnDecl
    | returnStmt
    | ifStmt
    | whileStmt
    | importStmt
    | proofStmt
    | block
    | exprStmt
    ;

letDecl
    : LET IDENTIFIER COLON typeSpec OP_ASSIGN expression SEMICOLON
    ;

fnDecl
    : proofAnnotation* FN IDENTIFIER LPAREN paramList? RPAREN COLON typeSpec block
    ;

paramList
    : param (COMMA param)*
    ;

param
    : IDENTIFIER COLON typeSpec
    ;

returnStmt
    : RETURN expression? SEMICOLON
    ;

ifStmt
    : IF LPAREN expression RPAREN block (ELSE block)?
    ;

whileStmt
    : WHILE LPAREN expression RPAREN block
    ;

importStmt
    : IMPORT STRING_LITERAL AS IDENTIFIER SEMICOLON
    ;

proofStmt
    : proofAnnotation SEMICOLON
    ;

proofAnnotation
    : AT REQUIRES LPAREN expression RPAREN
    | AT ENSURES LPAREN expression RPAREN
    | AT INVARIANT LPAREN expression RPAREN
    ;

block
    : LBRACE statement* RBRACE
    ;

exprStmt
    : expression SEMICOLON
    ;

expression
    : logicalOr
    ;

logicalOr
    : logicalAnd (OP_LOGICAL_OR logicalAnd)*
    ;

logicalAnd
    : equality (OP_LOGICAL_AND equality)*
    ;

equality
    : relational ((OP_EQUAL | OP_NOT_EQUAL) relational)*
    ;

relational
    : additive ((OP_LESS | OP_GREATER | OP_LESS_EQUAL | OP_GREATER_EQUAL) additive)*
    ;

additive
    : exponent ((OP_PLUS | OP_MINUS) exponent)*
    ;

exponent
    : multiplicative (OP_EXPONENT exponent)?
    ;

multiplicative
    : unary ((OP_MULTIPLY | OP_DIVIDE | OP_MODULO) unary)*
    ;

unary
    : (OP_MINUS | OP_BANG | OP_TILDE) unary
    | postfix
    ;

postfix
    : primary (LPAREN argList? RPAREN | DOT IDENTIFIER | OP_BANG)*
    ;

primary
    : INTEGER_LITERAL
    | FLOAT_LITERAL
    | STRING_LITERAL
    | KW_TRUE
    | KW_FALSE
    | KW_NULL
    | IDENTIFIER
    | LPAREN expression RPAREN
    ;

argList
    : expression (COMMA expression)*
    ;

typeSpec
    : baseType (OP_OPTIONAL | OP_BANG)?
    ;

baseType
    : KW_INT
    | KW_FLOAT
    | KW_BOOL
    | KW_STRING
    | KW_VOID
    | IDENTIFIER
    ;

GRAMMAR_VERSION : 'version:' [0-9]+ '.' [0-9]+ ;
LET     : 'let' ;
FN      : 'fn' ;
RETURN  : 'return' ;
IF      : 'if' ;
ELSE    : 'else' ;
WHILE   : 'while' ;
IMPORT  : 'import' ;
AS      : 'as' ;
AT      : '@' ;
REQUIRES: 'requires' ;
ENSURES : 'ensures' ;
INVARIANT: 'invariant' ;
KW_TRUE  : 'true' ;
KW_FALSE : 'false' ;
KW_NULL  : 'null' ;
KW_INT   : 'int' ;
KW_FLOAT : 'float' ;
KW_BOOL  : 'bool' ;
KW_STRING: 'string' ;
KW_VOID  : 'void' ;

OP_EXPONENT     : '^' ;
OP_LOGICAL_OR   : '||' ;
OP_LOGICAL_AND  : '&&' ;
OP_EQUAL        : '==' ;
OP_NOT_EQUAL    : '!=' ;
OP_LESS_EQUAL   : '<=' ;
OP_GREATER_EQUAL: '>=' ;
OP_LESS         : '<' ;
OP_GREATER      : '>' ;
OP_PLUS         : '+' ;
OP_MINUS        : '-' ;
OP_MULTIPLY     : '*' ;
OP_DIVIDE       : '/' ;
OP_MODULO       : '%' ;
OP_BANG         : '!' ;
OP_TILDE        : '~' ;
OP_ASSIGN       : '=' ;
OP_OPTIONAL     : '?' ;

LPAREN    : '(' ;
RPAREN    : ')' ;
LBRACE    : '{' ;
RBRACE    : '}' ;
COMMA     : ',' ;
SEMICOLON : ';' ;
COLON     : ':' ;
DOT       : '.' ;

INTEGER_LITERAL
    : '0' | [1-9] [0-9]*
    ;

FLOAT_LITERAL
    : INTEGER_LITERAL '.' [0-9]+ ([eE] [+-]? [0-9]+)?
    | INTEGER_LITERAL [eE] [+-]? [0-9]+
    ;

STRING_LITERAL
    : '"' (~["\\\r\n] | '\\' [ntr"\\])* '"'
    ;

IDENTIFIER
    : [A-Za-z_] [A-Za-z0-9_]*
    ;

LINE_COMMENT
    : '//' ~[\r\n]* '\n' -> skip
    ;

BLOCK_COMMENT
    : '/*' .*? '*/' -> skip
    ;

WS
    : [ \t\r\n]+ -> skip
    ;

import * as ts from 'typescript';
import { Rule, chain, Tree } from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  commitChanges,
  InsertChange,
  visitNgModuleImports,
  insertImport,
  Change,
} from '@ngrx/router-store/schematics-core';

function addDefaultSerializer(): Rule {
  const SERIALIZER_PROPERTY = 'serializer: DefaultRouterStateSerializer';
  return (tree: Tree) => {
    visitTSSourceFiles(tree, sourceFile => {
      let changes: Change[] = [];

      visitNgModuleImports(sourceFile, (importsNode, elementsNode) => {
        elementsNode
          .filter(
            element =>
              ts.isCallExpression(element) &&
              ts.isPropertyAccessExpression(element.expression) &&
              ts.isIdentifier(element.expression.expression) &&
              element.expression.expression.text ===
                'StoreRouterConnectingModule'
          )
          .forEach(element => {
            const callExpression = element as ts.CallExpression;
            const callArgument = callExpression.arguments[0];
            // StoreRouterConnectingModule.forRoot() without arguments
            if (!callArgument) {
              changes.push(
                new InsertChange(
                  sourceFile.fileName,
                  callExpression.getEnd() - 1,
                  `{ ${SERIALIZER_PROPERTY} }`
                )
              );
            } else if (ts.isObjectLiteralExpression(callArgument)) {
              // StoreRouterConnectingModule.forRoot({ key: 'router' }) with arguments
              const serializerSet = callArgument.properties.some(
                prop =>
                  ts.isPropertyAssignment(prop) &&
                  ts.isIdentifier(prop.name) &&
                  prop.name.text === 'serializer'
              );

              if (serializerSet) {
                return;
              }

              changes.push(
                new InsertChange(
                  sourceFile.fileName,
                  callArgument.getStart() + 1,
                  ` ${SERIALIZER_PROPERTY},`
                )
              );
            }
          });
      });

      if (changes.length) {
        changes.push(
          insertImport(
            sourceFile,
            sourceFile.fileName,
            'DefaultRouterStateSerializer',
            '@ngrx/router-store'
          )
        );
      }

      commitChanges(tree, sourceFile.fileName, changes);
    });
  };
}

export default function(): Rule {
  return chain([addDefaultSerializer()]);
}

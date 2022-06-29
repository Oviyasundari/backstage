/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, {
  Dispatch,
  SetStateAction,
  useContext,
  useState,
  memo,
  ReactNode,
  useMemo,
} from 'react';
import useAsync, { AsyncState } from 'react-use/lib/useAsync';

import {
  CompoundEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import {
  createVersionedContext,
  createVersionedValueMap,
} from '@backstage/version-bridge';

import { useApi } from '@backstage/core-plugin-api';

import { techdocsApiRef } from './api';
import { TechDocsEntityMetadata, TechDocsMetadata } from './types';
import { useParams } from 'react-router-dom';

const areEntityRefsEqual = (
  prevEntityRef: CompoundEntityRef,
  nextEntityRef: CompoundEntityRef,
) => {
  return (
    stringifyEntityRef(prevEntityRef) === stringifyEntityRef(nextEntityRef)
  );
};

const arePathsEqual = (prevPath?: string, nextPath?: string) => {
  return prevPath === nextPath;
};

/**
 * @public type for the value of the TechDocsReaderPageContext
 */
export type TechDocsReaderPageValue = {
  metadata: AsyncState<TechDocsMetadata>;
  path: string;
  entityRef: CompoundEntityRef;
  entityMetadata: AsyncState<TechDocsEntityMetadata>;
  shadowRoot?: ShadowRoot;
  setShadowRoot: Dispatch<SetStateAction<ShadowRoot | undefined>>;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  subtitle: string;
  setSubtitle: Dispatch<SetStateAction<string>>;
  /**
   * @deprecated property can be passed down directly to the `TechDocsReaderPageContent` instead.
   */
  onReady?: () => void;
};

const defaultTechDocsReaderPageValue: TechDocsReaderPageValue = {
  path: '',
  title: '',
  subtitle: '',
  setTitle: () => {},
  setSubtitle: () => {},
  setShadowRoot: () => {},
  metadata: { loading: true },
  entityMetadata: { loading: true },
  entityRef: { kind: '', name: '', namespace: '' },
};

const TechDocsReaderPageContext = createVersionedContext<{
  1: TechDocsReaderPageValue;
}>('techdocs-reader-page-context');

/**
 * render function for {@link TechDocsReaderPageProvider}
 *
 * @public
 */
export type TechDocsReaderPageProviderRenderFunction = (
  value: TechDocsReaderPageValue,
) => JSX.Element;

/**
 * Props for {@link TechDocsReaderPageProvider}
 *
 * @public
 */
export type TechDocsReaderPageProviderProps = {
  path?: string;
  entityRef: CompoundEntityRef;
  children: TechDocsReaderPageProviderRenderFunction | ReactNode;
};

type TechDocsReaderPageState = Partial<
  Pick<TechDocsReaderPageProviderProps, 'path' | 'entityRef'>
>;

const useTechDocsReaderPageState = (
  initialState: TechDocsReaderPageState = {},
): Required<TechDocsReaderPageState> => {
  const params = useParams();

  const defaultState = useMemo(() => {
    const { namespace, kind, name, '*': path = '' } = params;
    return { path, entityRef: { namespace, kind, name } };
  }, [params]);

  return { ...defaultState, ...initialState };
};

/**
 * A context to store the reader page state
 * @public
 */
export const TechDocsReaderPageProvider = memo(
  ({ children, ...rest }: TechDocsReaderPageProviderProps) => {
    const techdocsApi = useApi(techdocsApiRef);
    const { path = '', entityRef } = useTechDocsReaderPageState(rest);

    const metadata = useAsync(async () => {
      return techdocsApi.getTechDocsMetadata(entityRef);
    }, [entityRef]);

    const entityMetadata = useAsync(async () => {
      return techdocsApi.getEntityMetadata(entityRef);
    }, [entityRef]);

    const [title, setTitle] = useState(defaultTechDocsReaderPageValue.title);
    const [subtitle, setSubtitle] = useState(
      defaultTechDocsReaderPageValue.subtitle,
    );
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | undefined>(
      defaultTechDocsReaderPageValue.shadowRoot,
    );

    const value = {
      metadata,
      path,
      entityRef,
      entityMetadata,
      shadowRoot,
      setShadowRoot,
      title,
      setTitle,
      subtitle,
      setSubtitle,
    };
    const versionedValue = createVersionedValueMap({ 1: value });

    return (
      <TechDocsReaderPageContext.Provider value={versionedValue}>
        {children instanceof Function ? children(value) : children}
      </TechDocsReaderPageContext.Provider>
    );
  },
  (prevProps, nextProps) => {
    return (
      areEntityRefsEqual(prevProps.entityRef, nextProps.entityRef) &&
      arePathsEqual(prevProps.path, nextProps.path)
    );
  },
);

/**
 * Hook used to get access to shared state between reader page components.
 * @public
 */
export const useTechDocsReaderPage = () => {
  const versionedContext = useContext(TechDocsReaderPageContext);

  if (versionedContext === undefined) {
    return defaultTechDocsReaderPageValue;
  }

  const context = versionedContext.atVersion(1);
  if (context === undefined) {
    throw new Error('No context found for version 1.');
  }

  return context;
};
